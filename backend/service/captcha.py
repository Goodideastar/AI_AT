import uuid
import random
import base64
import io
import logging
import math
from PIL import Image, ImageDraw, ImageFont
from config.redis import redis_client

logger = logging.getLogger(__name__)

W = 320
H = 180
PUZZLE_SIZE = 44
TOLERANCE = 6
CAPTCHA_TTL = 180  # 3 分钟过期


def _draw_puzzle_path(draw: ImageDraw.ImageDraw, x: int, y: int):
    """在 ImageDraw 上绘制拼图块轮廓路径（顶部半圆凸起 + 右侧半圆凸起）。"""
    s = PUZZLE_SIZE
    r = s // 4
    # 顶边（含顶部凸起）
    draw.polygon([
        (x, y),
        (x + s // 2 - r, y),
        # 顶部半圆凸起
        *[(x + s // 2 + r * math.cos(math.pi - i * math.pi / 30),
           y - r * math.sin(math.pi - i * math.pi / 30))
          for i in range(31)],
        (x + s, y),
        # 右侧半圆凸起
        *[(x + s + r * math.sin(i * math.pi / 30),
           y + s // 2 - r * math.cos(i * math.pi / 30))
          for i in range(31)],
        (x + s, y + s),
        (x, y + s),
    ], fill=None)


def _make_puzzle_mask() -> Image.Image:
    """创建 320×180 的拼图块 mask（目标位置处为白色，其余黑色）。"""
    mask = Image.new('L', (W, H), 0)
    return mask


def _make_piece_mask() -> Image.Image:
    """创建 PUZZLE_SIZE×PUZZLE_SIZE 的拼图块 mask（含凸起区域为白色）。"""
    mask = Image.new('L', (PUZZLE_SIZE + 12, PUZZLE_SIZE + 12), 0)
    draw = ImageDraw.Draw(mask)
    # 在 mask 内以 (6, 0) 为基准画拼图路径（留出凸起空间）
    ox, oy = 6, 0
    s = PUZZLE_SIZE
    r = s // 4
    points = [
        (ox, oy),
        (ox + s // 2 - r, oy),
        # 顶部凸起
        *[(ox + s // 2 + r * math.cos(math.pi - i * math.pi / 30),
           oy - r * math.sin(math.pi - i * math.pi / 30))
          for i in range(31)],
        (ox + s, oy),
        # 右侧凸起
        *[(ox + s + r * math.sin(i * math.pi / 30),
           oy + s // 2 - r * math.cos(i * math.pi / 30))
          for i in range(31)],
        (ox + s, oy + s),
        (ox, oy + s),
    ]
    draw.polygon(points, fill=255)
    return mask


def generate_captcha() -> dict:
    """生成一张滑动拼图验证码，返回 captcha_id、背景图、拼图块图的 base64。"""
    captcha_id = str(uuid.uuid4())

    # --- 生成背景 ---
    bg = Image.new('RGB', (W, H))
    draw = ImageDraw.Draw(bg)

    # 随机双色线性渐变
    hue_a = random.randint(0, 359)
    hue_b = (hue_a + random.randint(60, 180)) % 360
    for y_line in range(H):
        ratio = y_line / H
        h = hue_a + (hue_b - hue_a) * ratio
        r_c = int(128 + 127 * math.sin(math.radians(h)))
        g_c = int(128 + 127 * math.sin(math.radians(h + 120)))
        b_c = int(128 + 127 * math.sin(math.radians(h + 240)))
        draw.line([(0, y_line), (W, y_line)], fill=(r_c, g_c, b_c))

    # 18 个随机装饰圆
    for _ in range(18):
        cx = random.randint(0, W)
        cy = random.randint(0, H)
        cr = random.randint(6, 28)
        ch = random.randint(0, 359)
        ca = random.randint(30, 60)  # alpha 近似亮度
        rc = int(ca + 60 * math.sin(math.radians(ch)))
        gc = int(ca + 60 * math.sin(math.radians(ch + 120)))
        bc = int(ca + 60 * math.sin(math.radians(ch + 240)))
        draw.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=(rc, gc, bc))

    # --- 目标位置 ---
    target_x = random.randint(int(W * 0.35), int(W * 0.9) - PUZZLE_SIZE)
    target_y = random.randint(10, H - PUZZLE_SIZE - 10)

    # --- 在背景上画黑色半透明凹槽 ---
    hole_mask = _make_piece_mask()
    # 将 piece_mask 粘贴到与背景同尺寸的位置
    full_hole_mask = Image.new('L', (W, H), 0)
    full_hole_mask.paste(hole_mask, (target_x - 6, target_y))
    # 凹槽：半透明黑色叠加
    hole_overlay = Image.new('RGBA', (W, H), (0, 0, 0, 140))
    bg_rgba = bg.convert('RGBA')
    bg_rgba = Image.composite(hole_overlay, bg_rgba, full_hole_mask)
    bg = bg_rgba.convert('RGB')

    # --- 抠出拼图块（透明背景 RGBA PNG）---
    piece_region = bg.crop((target_x - 6, target_y, target_x - 6 + PUZZLE_SIZE + 12, target_y + PUZZLE_SIZE + 12))
    piece_mask = _make_piece_mask()
    piece = Image.new('RGBA', piece_region.size, (0, 0, 0, 0))
    piece = Image.composite(piece_region.convert('RGBA'), piece, piece_mask)

    # 给拼图块加白色半透明边框
    piece_draw = ImageDraw.Draw(piece)
    s = PUZZLE_SIZE
    r = s // 4
    ox, oy = 6, 0
    outline_points = [
        (ox, oy),
        (ox + s // 2 - r, oy),
        *[(ox + s // 2 + r * math.cos(math.pi - i * math.pi / 30),
           oy - r * math.sin(math.pi - i * math.pi / 30))
          for i in range(31)],
        (ox + s, oy),
        *[(ox + s + r * math.sin(i * math.pi / 30),
           oy + s // 2 - r * math.cos(i * math.pi / 30))
          for i in range(31)],
        (ox + s, oy + s),
        (ox, oy + s),
    ]
    piece_draw.polygon(outline_points, outline=(255, 255, 255, 180), fill=None)

    # --- Base64 编码 ---
    bg_buf = io.BytesIO()
    bg.save(bg_buf, format='PNG')
    bg_b64 = base64.b64encode(bg_buf.getvalue()).decode('utf-8')

    piece_buf = io.BytesIO()
    piece.save(piece_buf, format='PNG')
    piece_b64 = base64.b64encode(piece_buf.getvalue()).decode('utf-8')

    # --- Redis 存储目标 X 坐标 ---
    redis_client.set(f"captcha:{captcha_id}", str(target_x), ex=CAPTCHA_TTL)

    logger.info(f"[验证码] 生成拼图: id={captcha_id}")

    return {
        "captcha_id": captcha_id,
        "bg_image": bg_b64,
        "piece_image": piece_b64,
        "y": target_y,
    }


def verify_captcha(captcha_id: str, slide_x: int) -> bool:
    """
    验证滑动坐标是否匹配目标位置。通过后将 key 改为已验证标记。
    限制每个 captcha_id 最多 5 次尝试，防止暴力枚举坐标。
    """
    key = f"captcha:{captcha_id}"
    attempts_key = f"captcha_attempts:{captcha_id}"
    target_str = redis_client.get(key)
    if target_str is None:
        logger.warning(f"[验证码] 验证失败: id={captcha_id}, key 不存在或已过期")
        return False

    # 原子递增尝试次数，首次设置 5 分钟过期（与 CAPTCHA_TTL 对齐）
    attempts = redis_client.incr(attempts_key)
    if attempts == 1:
        redis_client.expire(attempts_key, CAPTCHA_TTL)
    if attempts > 5:
        # 超过 5 次尝试，删除 captcha 防止继续暴力
        redis_client.delete(key)
        redis_client.delete(attempts_key)
        logger.warning(f"[验证码] 尝试次数超限: id={captcha_id}, attempts={attempts}")
        return False

    target_x = int(target_str)
    distance = abs(slide_x - target_x)

    if distance <= TOLERANCE:
        # 验证通过：RENAME 到已验证标记，供 send_verify_code 消费；清理尝试计数
        redis_client.rename(key, f"captcha_ok:{captcha_id}")
        redis_client.delete(attempts_key)
        logger.info(f"[验证码] 滑动验证通过: id={captcha_id}, distance={distance}")
        return True
    else:
        # 验证失败：不删除 key，允许用户在尝试次数内重试
        logger.warning(f"[验证码] 滑动验证失败: id={captcha_id}, distance={distance}, attempts={attempts}")
        return False


def consume_captcha(captcha_id: str) -> bool:
    """消费已验证的验证码（一次性使用）。send_verify_code 调用。"""
    key = f"captcha_ok:{captcha_id}"
    if redis_client.delete(key):
        logger.info(f"[验证码] 消费验证码: id={captcha_id}")
        return True
    logger.warning(f"[验证码] 消费失败: id={captcha_id}, 未验证或已消费")
    return False


# ────────────────────────────────────────────────────────────
# 4 位数字图形验证码（用于登录防刷）
# ────────────────────────────────────────────────────────────
DIGIT_CAPTCHA_W = 120
DIGIT_CAPTCHA_H = 40
DIGIT_CAPTCHA_TTL = 300  # 5 分钟过期

# 加载 TrueType 字体：跨平台兼容（Linux 容器/Windows/Mac），全部失败则回退默认字体
_FONT_CANDIDATES = [
    "C:\\Windows\\Fonts\\arialbd.ttf",          # Windows
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",  # Linux (Debian/Ubuntu)
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",  # Linux (CentOS/RHEL)
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",  # Linux (Alpine)
    "/System/Library/Fonts/Helvetica.ttc",       # macOS
]
_DIGIT_FONT = ImageFont.load_default()
for _font_path in _FONT_CANDIDATES:
    try:
        _DIGIT_FONT = ImageFont.truetype(_font_path, 30)
        break
    except OSError:
        continue


def generate_digit_captcha() -> dict:
    """生成一张 4 位数字图形验证码，返回 captcha_id 和 base64 图片。"""
    captcha_id = str(uuid.uuid4())

    # 4 位数字
    code = "".join(random.choices("0123456789", k=4))

    img = Image.new("RGB", (DIGIT_CAPTCHA_W, DIGIT_CAPTCHA_H), (24, 24, 27))
    draw = ImageDraw.Draw(img)

    # 干扰线（直线 + 曲线混合，颜色偏亮增加干扰）
    for _ in range(14):
        x1 = random.randint(0, DIGIT_CAPTCHA_W)
        y1 = random.randint(0, DIGIT_CAPTCHA_H)
        x2 = random.randint(0, DIGIT_CAPTCHA_W)
        y2 = random.randint(0, DIGIT_CAPTCHA_H)
        line_color = (
            random.randint(100, 220),
            random.randint(100, 220),
            random.randint(100, 220),
        )
        draw.line([(x1, y1), (x2, y2)], fill=line_color, width=random.randint(2, 3))

    # 曲线干扰（贝塞尔近似：用多段折线模拟波浪线，穿过字符区域）
    for _ in range(4):
        x1 = random.randint(0, DIGIT_CAPTCHA_W // 3)
        y1 = random.randint(0, DIGIT_CAPTCHA_H)
        x2 = random.randint(DIGIT_CAPTCHA_W // 2, DIGIT_CAPTCHA_W)
        y2 = random.randint(0, DIGIT_CAPTCHA_H)
        ctrl_x = random.randint(DIGIT_CAPTCHA_W // 4, DIGIT_CAPTCHA_W * 3 // 4)
        ctrl_y = random.randint(-10, DIGIT_CAPTCHA_H + 10)
        curve_color = (
            random.randint(120, 220),
            random.randint(120, 220),
            random.randint(120, 220),
        )
        # 用 20 段折线近似贝塞尔曲线
        pts = []
        for t_i in range(21):
            t = t_i / 20
            px = int((1 - t) ** 2 * x1 + 2 * (1 - t) * t * ctrl_x + t ** 2 * x2)
            py = int((1 - t) ** 2 * y1 + 2 * (1 - t) * t * ctrl_y + t ** 2 * y2)
            pts.append((px, py))
        draw.line(pts, fill=curve_color, width=2)

    # 干扰点（增加密度）
    for _ in range(280):
        x = random.randint(0, DIGIT_CAPTCHA_W - 1)
        y = random.randint(0, DIGIT_CAPTCHA_H - 1)
        dot_color = (
            random.randint(80, 220),
            random.randint(80, 220),
            random.randint(80, 220),
        )
        draw.point((x, y), fill=dot_color)

    # 绘制 4 个数字（TrueType 字体直接绘制，颜色随机 + 轻微旋转 + 错位 + 扭曲）
    char_w = DIGIT_CAPTCHA_W // 4
    for i, ch in enumerate(code):
        char_img = Image.new("RGBA", (char_w, DIGIT_CAPTCHA_H), (0, 0, 0, 0))
        char_draw = ImageDraw.Draw(char_img)
        # 每个字符独立随机颜色，最低亮度约 100
        text_color = (
            random.randint(100, 220),
            random.randint(100, 220),
            random.randint(100, 220),
            255,
        )
        # 测量字符尺寸用于居中
        bbox = char_draw.textbbox((0, 0), ch, font=_DIGIT_FONT)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        tx = (char_w - tw) // 2 - bbox[0]
        ty = (DIGIT_CAPTCHA_H - th) // 2 - bbox[1]
        char_draw.text((tx, ty), ch, font=_DIGIT_FONT, fill=text_color)
        # 随机旋转 -20~20 度（加大角度增加识别难度）
        angle = random.randint(-20, 20)
        rotated = char_img.rotate(angle, expand=True, resample=Image.Resampling.BILINEAR)
        # 居中粘贴，并加随机 Y/X 偏移
        offset_y = random.randint(-3, 3)
        paste_x = i * char_w + (char_w - rotated.width) // 2 + random.randint(-2, 2)
        paste_y = offset_y + (DIGIT_CAPTCHA_H - rotated.height) // 2
        img.paste(
            rotated,
            (paste_x, paste_y),
            rotated,
        )

    # 字符绘制后再叠加一层噪点，覆盖在字符上，进一步降低 OCR 识别率
    for _ in range(160):
        x = random.randint(0, DIGIT_CAPTCHA_W - 1)
        y = random.randint(0, DIGIT_CAPTCHA_H - 1)
        dot_color = (
            random.randint(60, 180),
            random.randint(60, 180),
            random.randint(60, 180),
        )
        draw.point((x, y), fill=dot_color)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    image_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    # Redis 存储：存答案，TTL 5 分钟
    redis_client.set(f"login_captcha:{captcha_id}", code, ex=DIGIT_CAPTCHA_TTL)

    logger.info(f"[验证码] 生成数字验证码: id={captcha_id}")
    return {"captcha_id": captcha_id, "image": image_b64}


def verify_digit_captcha(captcha_id: str, user_code: str) -> bool:
    """校验用户输入的 4 位数字是否正确。校验后无论对错都删除（一次性）。"""
    key = f"login_captcha:{captcha_id}"
    stored = redis_client.get(key)
    if stored is None:
        logger.warning(f"[验证码] 数字验证码校验失败: id={captcha_id}, key 不存在或已过期")
        return False

    # 一次性：无论对错都删除，防止暴力枚举
    redis_client.delete(key)

    if stored.strip() == user_code.strip():
        logger.info(f"[验证码] 数字验证码校验通过: id={captcha_id}")
        return True
    logger.warning(f"[验证码] 数字验证码校验失败: id={captcha_id}")
    return False
