# backend/service/analysis/ai_analyst.py
"""
基于 LangChain 的 AI 市场分析服务

使用大语言模型对行情数据和技术指标进行综合分析，
输出趋势判断、支撑阻力位、交易建议以及结构化的交易信号。
"""

import json
import logging
import os
from typing import Any, Dict, List, Optional

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 分析提示词模板
# ---------------------------------------------------------------------------

ANALYSIS_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "你是一位专业的加密货币/金融市场量化分析师。"
            "请根据提供的行情数据和技术指标，给出客观、严谨的市场分析。"
            "回答必须使用 JSON 格式，不要包含任何多余文字。",
        ),
        (
            "human",
            "请分析 {symbol} 的市场行情。\n\n"
            "最近 K 线数据（按时间从旧到新）：\n{klines_text}\n\n"
            "技术指标：\n{indicators_text}\n\n"
            "请以如下 JSON 结构返回分析结果（不要包含 markdown 代码块标记）：\n"
            "{{\n"
            '  "trend": "上涨 / 下跌 / 震荡",\n'
            '  "trend_strength": "强 / 中 / 弱",\n'
            '  "support_levels": [价格1, 价格2],\n'
            '  "resistance_levels": [价格1, 价格2],\n'
            '  "key_observations": "对当前行情的简要描述",\n'
            '  "suggestion": "做多 / 做空 / 观望",\n'
            '  "reason": "给出该建议的理由"\n'
            "}}",
        ),
    ]
)

SIGNAL_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "你是一位专业的交易信号生成器。"
            "根据市场分析结果，输出一个结构化的交易信号。"
            "回答必须使用 JSON 格式，不要包含任何多余文字。",
        ),
        (
            "human",
            "交易品种：{symbol}\n\n"
            "市场分析结果：\n{analysis_text}\n\n"
            "请根据以上分析生成交易信号，以如下 JSON 结构返回（不要包含 markdown 代码块标记）：\n"
            "{{\n"
            '  "direction": "long / short / neutral",\n'
            '  "entry_price": 入场价格（数字）,\n'
            '  "stop_loss": 止损价格（数字）,\n'
            '  "target_price": 目标价格（数字）,\n'
            '  "confidence": 信心度（0.0 ~ 1.0 之间的数字）,\n'
            '  "reason": "信号生成理由"\n'
            "}}\n"
            "如果建议观望，direction 填写 neutral，其余价格字段填 0。",
        ),
    ]
)


def _format_klines(klines: List[Dict]) -> str:
    """将 K 线数据格式化为可读文本，供提示词使用"""
    lines: List[str] = []
    # 最多取最近 30 根 K 线，避免提示词过长
    for k in klines[-30:]:
        lines.append(
            f"开:{k.get('open')} 高:{k.get('high')} "
            f"低:{k.get('low')} 收:{k.get('close')} "
            f"量:{k.get('volume')} 时间:{k.get('open_time', k.get('timestamp', ''))}"
        )
    return "\n".join(lines) if lines else "暂无数据"


def _format_indicators(indicators: Dict[str, Any]) -> str:
    """将技术指标字典格式化为可读文本"""
    if not indicators:
        return "暂无指标数据"
    lines: List[str] = []
    for name, value in indicators.items():
        lines.append(f"{name}: {value}")
    return "\n".join(lines)


def _parse_json_response(text: str) -> Dict:
    """
    从 LLM 返回的文本中提取 JSON 对象。
    兼容模型偶尔包裹 ```json ... ``` 的情况。
    """
    cleaned = text.strip()
    # 去除可能的 markdown 代码块标记
    if cleaned.startswith("```"):
        # 安全地查找换行符，避免 IndexError
        newline_idx = cleaned.find("\n")
        if newline_idx != -1:
            cleaned = cleaned[newline_idx + 1:]
        else:
            # 没有换行符，直接跳过前3个字符（```）
            cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("LLM 返回内容无法解析为 JSON，原始内容：%s", cleaned)
        return {"raw": cleaned}


class MarketAnalyst:
    """AI 市场分析服务"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: float = 0.3,
    ):
        """
        初始化分析器。

        优先使用显式传入的参数，否则从环境变量读取：
        - API_KEY：OpenAI 兼容接口的 API Key
        - BASE_URL：接口地址
        - MODEL_NAME：模型名称
        """
        self.api_key = api_key or os.getenv("API_KEY", "")
        self.base_url = base_url or os.getenv("BASE_URL", "")
        self.model_name = model_name or os.getenv("MODEL_NAME", "gpt-4o-mini")

        if not self.api_key:
            logger.warning("API_KEY 未配置，AI 分析功能将不可用")

        self.llm = ChatOpenAI(
            model=self.model_name,
            openai_api_key=self.api_key,
            openai_api_base=self.base_url or None,
            temperature=temperature,
        )

    # ------------------------------------------------------------------
    # 公开接口
    # ------------------------------------------------------------------

    async def analyze_market(
        self,
        symbol: str,
        klines: List[Dict],
        indicators: Optional[Dict[str, Any]] = None,
    ) -> Dict:
        """
        对指定品种进行市场分析。

        Args:
            symbol: 交易品种，如 "BTCUSDT"
            klines: K 线数据列表，每条包含 open/high/low/close/volume/open_time
            indicators: 技术指标字典，如 {"RSI": 55.3, "MACD": {...}}

        Returns:
            分析结果字典，包含 trend / support_levels / resistance_levels /
            suggestion 等字段。解析失败时返回 {"raw": <原始文本>}。
        """
        indicators = indicators or {}
        prompt = ANALYSIS_PROMPT.format_messages(
            symbol=symbol,
            klines_text=_format_klines(klines),
            indicators_text=_format_indicators(indicators),
        )

        try:
            response = await self.llm.ainvoke(prompt)
            result = _parse_json_response(response.content)
            logger.info("AI 市场分析完成：%s，趋势：%s", symbol, result.get("trend"))
            return result
        except Exception as e:
            logger.error("AI 市场分析异常：%s - %s", symbol, e)
            return {"error": str(e)}

    async def generate_signal(self, symbol: str, analysis: Dict) -> Dict:
        """
        根据市场分析结果生成交易信号。

        Args:
            symbol: 交易品种
            analysis: analyze_market 返回的分析结果

        Returns:
            交易信号字典，包含 direction / entry_price / stop_loss /
            target_price / confidence / reason。
        """
        analysis_text = json.dumps(analysis, ensure_ascii=False, indent=2)
        prompt = SIGNAL_PROMPT.format_messages(
            symbol=symbol,
            analysis_text=analysis_text,
        )

        try:
            response = await self.llm.ainvoke(prompt)
            signal = _parse_json_response(response.content)
            # 对数值字段做基本校验，避免模型返回字符串
            for num_field in ("entry_price", "stop_loss", "target_price", "confidence"):
                if num_field in signal:
                    try:
                        signal[num_field] = float(signal[num_field])
                    except (TypeError, ValueError):
                        signal[num_field] = 0.0
            logger.info(
                "AI 交易信号生成完成：%s，方向：%s，信心度：%s",
                symbol,
                signal.get("direction"),
                signal.get("confidence"),
            )
            return signal
        except Exception as e:
            logger.error("AI 交易信号生成异常：%s - %s", symbol, e)
            return {"error": str(e)}
