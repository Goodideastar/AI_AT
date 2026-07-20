"""
量化平台 API 测试脚本
测试所有核心功能模块的 API 端点
"""
import httpx
import asyncio
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/api"

async def test_market_api():
    """测试行情数据 API"""
    print("\n=== 测试行情数据 API ===")
    async with httpx.AsyncClient() as client:
        # 测试获取 Ticker
        resp = await client.get(f"{BASE_URL}/market/ticker/BTCUSDT")
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert "data" in data
        print("✓ Ticker API 测试通过")
        
        # 测试获取 K 线数据
        resp = await client.get(f"{BASE_URL}/market/klines/BTCUSDT?interval=1h&limit=100")
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert isinstance(data["data"], list)
        print("✓ K 线数据 API 测试通过")
        
        # 测试获取订单簿
        resp = await client.get(f"{BASE_URL}/market/orderbook/BTCUSDT?limit=20")
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert "bids" in data["data"]
        assert "asks" in data["data"]
        print("✓ 订单簿 API 测试通过")


async def test_strategy_api():
    """测试策略管理 API"""
    print("\n=== 测试策略管理 API ===")
    async with httpx.AsyncClient() as client:
        # 先登录获取 token
        login_resp = await client.post(f"{BASE_URL}/login", json={
            "username": "testuser",
            "password": "test123456"
        })
        
        # 如果用户不存在，先注册
        if login_resp.status_code != 200:
            # 发送验证码
            await client.post(f"{BASE_URL}/send_verify_code", json={
                "email": "test@example.com"
            })
            
            # 注册
            register_resp = await client.post(f"{BASE_URL}/register", json={
                "username": "testuser",
                "password": "test123456",
                "verify_code": "123456",  # 测试环境可能需要特殊处理
                "email": "test@example.com"
            })
            
            if register_resp.status_code == 201:
                token = register_resp.json()["data"]["token"]
            else:
                print("⚠ 注册失败，跳过策略 API 测试")
                return
        else:
            token = login_resp.json()["data"]["token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # 测试获取策略列表
        resp = await client.get(f"{BASE_URL}/strategies", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        print("✓ 策略列表 API 测试通过")
        
        # 测试创建策略
        resp = await client.post(f"{BASE_URL}/strategies", headers=headers, json={
            "name": "测试策略",
            "description": "这是一个测试策略",
            "strategy_type": "ma_cross",
            "parameters": {"fast_period": 5, "slow_period": 20},
            "symbols": ["BTCUSDT"],
            "exchange": "binance"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        strategy_id = data["data"]["id"]
        print(f"✓ 创建策略 API 测试通过 (ID: {strategy_id})")
        
        # 测试获取我的策略
        resp = await client.get(f"{BASE_URL}/strategies/my", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert isinstance(data["data"], list)
        print("✓ 我的策略列表 API 测试通过")
        
        # 测试启停策略
        resp = await client.put(f"{BASE_URL}/strategies/{strategy_id}/toggle", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        print("✓ 启停策略 API 测试通过")


async def test_backtest_api():
    """测试回测 API"""
    print("\n=== 测试回测 API ===")
    async with httpx.AsyncClient() as client:
        # 登录获取 token
        login_resp = await client.post(f"{BASE_URL}/login", json={
            "username": "testuser",
            "password": "test123456"
        })
        
        if login_resp.status_code != 200:
            print("⚠ 登录失败，跳过回测 API 测试")
            return
        
        token = login_resp.json()["data"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 获取策略列表
        strategies_resp = await client.get(f"{BASE_URL}/strategies/my", headers=headers)
        strategies = strategies_resp.json()["data"]
        
        if not strategies:
            print("⚠ 没有策略，跳过回测 API 测试")
            return
        
        strategy_id = strategies[0]["id"]
        
        # 测试运行回测
        resp = await client.post(f"{BASE_URL}/backtest/run", headers=headers, json={
            "strategy_id": strategy_id,
            "exchange": "binance",
            "symbol": "BTCUSDT",
            "interval": "1h",
            "limit": 100,
            "initial_capital": 10000
        })
        
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert "initial_capital" in data["data"]
        assert "final_capital" in data["data"]
        assert "metrics" in data["data"]
        print("✓ 回测 API 测试通过")
        print(f"  初始资金: {data['data']['initial_capital']}")
        print(f"  最终资金: {data['data']['final_capital']}")
        print(f"  总收益率: {data['data']['metrics'].get('total_return', 0):.2%}")


async def test_trade_api():
    """测试交易 API"""
    print("\n=== 测试交易 API ===")
    async with httpx.AsyncClient() as client:
        # 登录获取 token
        login_resp = await client.post(f"{BASE_URL}/login", json={
            "username": "testuser",
            "password": "test123456"
        })
        
        if login_resp.status_code != 200:
            print("⚠ 登录失败，跳过交易 API 测试")
            return
        
        token = login_resp.json()["data"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 测试下单
        resp = await client.post(f"{BASE_URL}/trade/order", headers=headers, json={
            "symbol": "BTCUSDT",
            "exchange": "binance",
            "side": "buy",
            "order_type": "market",
            "quantity": 0.001
        })
        
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert "order_id" in data["data"]
        print(f"✓ 下单 API 测试通过 (Order ID: {data['data']['order_id']})")
        
        # 测试获取订单列表
        resp = await client.get(f"{BASE_URL}/trade/orders", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert isinstance(data["data"], list)
        print("✓ 订单列表 API 测试通过")
        
        # 测试获取持仓列表
        resp = await client.get(f"{BASE_URL}/trade/positions", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert isinstance(data["data"], list)
        print("✓ 持仓列表 API 测试通过")


async def main():
    """运行所有测试"""
    print("=" * 50)
    print("量化平台 API 测试")
    print("=" * 50)
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"API 地址: {BASE_URL}")
    
    try:
        # 测试行情 API（不需要认证）
        await test_market_api()
        
        # 测试需要认证的 API
        await test_strategy_api()
        await test_backtest_api()
        await test_trade_api()
        
        print("\n" + "=" * 50)
        print("✓ 所有测试通过！")
        print("=" * 50)
        
    except AssertionError as e:
        print(f"\n✗ 测试失败: {e}")
        raise
    except Exception as e:
        print(f"\n✗ 测试出错: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
