package id.wphone.core.input

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Keyboard
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.wphone.core.config.GamepadButtonSpec
import id.wphone.core.config.GamepadSkin
import id.wphone.core.config.InputOverlayPreset
import kotlin.math.hypot
import kotlin.math.roundToInt

/**
 * Legacy helper kept for compatibility; renders the unified desktop modifier row.
 */
@Composable
fun DesktopModifierBar(
    keys: List<String> = listOf(
        "ESC", "TAB", "CTRL", "ALT", "SHIFT", "WIN",
        "F1", "F2", "F3", "F4", "F5", "F11", "F12",
        "DEL", "HOME", "END", "PGUP", "PGDN", "←", "↑", "↓", "→"
    ),
    alphaLevel: Float = 0.92f,
    onDispatchKey: (key: String, ctrl: Boolean, alt: Boolean, shift: Boolean) -> Unit
) {
    var stickyCtrl by remember { mutableStateOf(false) }
    var stickyAlt by remember { mutableStateOf(false) }
    var stickyShift by remember { mutableStateOf(false) }
    var stickyWin by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF0F172A).copy(alpha = alphaLevel))
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 8.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        keys.forEach { key ->
            val upper = key.uppercase()
            val isActive = (upper == "CTRL" && stickyCtrl) ||
                (upper == "ALT" && stickyAlt) ||
                (upper == "SHIFT" && stickyShift) ||
                ((upper == "WIN" || upper == "META") && stickyWin)
            Surface(
                shape = RoundedCornerShape(6.dp),
                color = if (isActive) Color(0xFF0078D4) else Color(0xFF1E293B),
                border = BorderStroke(1.dp, if (isActive) Color(0xFF38BDF8) else Color(0xFF334155)),
                modifier = Modifier
                    .defaultMinSize(minWidth = 42.dp, minHeight = 36.dp)
                    .clickable {
                        when (upper) {
                            "CTRL" -> stickyCtrl = !stickyCtrl
                            "ALT" -> stickyAlt = !stickyAlt
                            "SHIFT" -> stickyShift = !stickyShift
                            "WIN", "META" -> stickyWin = !stickyWin
                            else -> {
                                onDispatchKey(key, stickyCtrl, stickyAlt, stickyShift)
                                stickyCtrl = false
                                stickyAlt = false
                                stickyShift = false
                                stickyWin = false
                            }
                        }
                    }
            ) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.padding(horizontal = 9.dp, vertical = 7.dp)
                ) {
                    Text(
                        text = key,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        fontFamily = FontFamily.Monospace,
                        color = Color.White
                    )
                }
            }
        }
    }
}

@Composable
fun GamingVirtualPadBar(
    buttons: List<Pair<String, String>> = listOf(
        "W" to "Up", "A" to "Left", "S" to "Down", "D" to "Right",
        "SPACE" to "Jump", "SHIFT" to "Sprint", "E" to "Interact", "ESC" to "Menu"
    ),
    alphaLevel: Float = 0.88f,
    onDispatchKey: (key: String, ctrl: Boolean, alt: Boolean, shift: Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF111827).copy(alpha = alphaLevel))
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 8.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        buttons.forEach { (key, desc) ->
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = Color(0xFF1E293B),
                border = BorderStroke(1.dp, Color(0xFF334155)),
                modifier = Modifier
                    .defaultMinSize(minWidth = 54.dp, minHeight = 44.dp)
                    .clickable { onDispatchKey(key, false, false, false) }
            ) {
                Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)) {
                    Text(text = key, style = MaterialTheme.typography.labelMedium, color = Color(0xFF38BDF8))
                    Text(text = desc, style = MaterialTheme.typography.labelSmall, color = Color(0xFFCBD5E1))
                }
            }
        }
    }
}

/**
 * Unified Desktop + QWERTY translucent keyboard panel.
 * Combines customizable PC modifier/function/arrow keys directly above an interactive 4-row QWERTY deck,
 * plus System IME & Hide actions in one cohesive unit.
 */
@Composable
fun UnifiedQwertyDesktopKeyboard(
    preset: InputOverlayPreset,
    onDispatchKey: (key: String, ctrl: Boolean, alt: Boolean, shift: Boolean) -> Unit,
    onOpenSystemIme: () -> Unit,
    onHide: () -> Unit,
    modifier: Modifier = Modifier
) {
    var stickyCtrl by remember { mutableStateOf(false) }
    var stickyAlt by remember { mutableStateOf(false) }
    var stickyShift by remember { mutableStateOf(false) }
    var capsOn by remember { mutableStateOf(false) }

    val bgAlpha = preset.opacity.coerceIn(0.45f, 0.96f)

    fun fireKey(key: String) {
        val upper = key.uppercase()
        when (upper) {
            "CTRL" -> stickyCtrl = !stickyCtrl
            "ALT" -> stickyAlt = !stickyAlt
            "SHIFT" -> {
                stickyShift = !stickyShift
                capsOn = stickyShift
            }
            "CAPS" -> capsOn = !capsOn
            else -> {
                onDispatchKey(key, stickyCtrl, stickyAlt, stickyShift || capsOn)
                stickyCtrl = false
                stickyAlt = false
                stickyShift = false
            }
        }
    }

    val row1 = listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-")
    val row2 = listOf("Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P")
    val row3 = listOf("A", "S", "D", "F", "G", "H", "J", "K", "L", ";")
    val row4 = listOf("Z", "X", "C", "V", "B", "N", "M", ",", ".", "/")

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Color(0xFF090E1A).copy(alpha = bgAlpha))
            .border(1.dp, Color(0xFF1E293B))
            .padding(horizontal = 6.dp, vertical = 5.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        // Top Header + Actions
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "UNIFIED PC KEYBOARD",
                color = Color(0xFF94A3B8),
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                fontFamily = FontFamily.Monospace,
                modifier = Modifier.padding(start = 4.dp)
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = Color(0xFF1E293B),
                    border = BorderStroke(1.dp, Color(0xFF334155)),
                    modifier = Modifier.clickable { onOpenSystemIme() }
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(Icons.Default.Keyboard, contentDescription = null, tint = Color(0xFF38BDF8), modifier = Modifier.size(13.dp))
                        Text("System IME", color = Color(0xFFE2E8F0), fontSize = 11.sp)
                    }
                }
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = Color(0xFF1E293B),
                    border = BorderStroke(1.dp, Color(0xFF334155)),
                    modifier = Modifier.clickable { onHide() }
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(Icons.Default.Close, contentDescription = null, tint = Color(0xFFCBD5E1), modifier = Modifier.size(13.dp))
                        Text("Hide", color = Color(0xFFCBD5E1), fontSize = 11.sp)
                    }
                }
            }
        }

        // Scrollable Desktop Keys Strip (ESC, TAB, CTRL, ALT, SHIFT, WIN, F1-F12, Arrows)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            preset.desktopKeys.forEach { key ->
                val upper = key.uppercase()
                val active = (upper == "CTRL" && stickyCtrl) ||
                    (upper == "ALT" && stickyAlt) ||
                    (upper == "SHIFT" && stickyShift)
                Surface(
                    shape = RoundedCornerShape(5.dp),
                    color = if (active) Color(0xFF0078D4) else Color(0xFF172033),
                    border = BorderStroke(1.dp, if (active) Color(0xFF38BDF8) else Color(0xFF283548)),
                    modifier = Modifier
                        .defaultMinSize(minWidth = 38.dp, minHeight = 32.dp)
                        .clickable { fireKey(key) }
                ) {
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp)) {
                        Text(
                            text = key,
                            color = if (active) Color.White else Color(0xFFE2E8F0),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
            }
        }

        // Interactive 4-Row QWERTY Deck directly attached underneath Desktop bar
        if (preset.qwertyEnabled) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                QwertyKeyRow(keys = row1, shiftActive = stickyShift || capsOn, onKey = ::fireKey)
                QwertyKeyRow(keys = row2, shiftActive = stickyShift || capsOn, onKey = ::fireKey)
                QwertyKeyRow(keys = row3, shiftActive = stickyShift || capsOn, onKey = ::fireKey)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(3.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    QwertyActionChip(
                        label = "⇧",
                        active = stickyShift || capsOn,
                        modifier = Modifier.weight(1.25f),
                        onClick = { fireKey("SHIFT") }
                    )
                    row4.forEach { k ->
                        QwertyKeyButton(
                            label = if (stickyShift || capsOn) k else k.lowercase(),
                            modifier = Modifier.weight(1f),
                            onClick = { fireKey(k) }
                        )
                    }
                    QwertyActionChip(
                        label = "⌫",
                        active = false,
                        modifier = Modifier.weight(1.35f),
                        onClick = { fireKey("BACKSPACE") }
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    QwertyActionChip(
                        label = "CTRL",
                        active = stickyCtrl,
                        modifier = Modifier.weight(1.2f),
                        onClick = { fireKey("CTRL") }
                    )
                    QwertyActionChip(
                        label = "ALT",
                        active = stickyAlt,
                        modifier = Modifier.weight(1.1f),
                        onClick = { fireKey("ALT") }
                    )
                    QwertyActionChip(
                        label = "SPACE",
                        active = false,
                        modifier = Modifier.weight(4.2f),
                        onClick = { fireKey("SPACE") }
                    )
                    QwertyActionChip(
                        label = "TAB",
                        active = false,
                        modifier = Modifier.weight(1.1f),
                        onClick = { fireKey("TAB") }
                    )
                    QwertyActionChip(
                        label = "ENTER",
                        active = true,
                        modifier = Modifier.weight(1.6f),
                        onClick = { fireKey("ENTER") }
                    )
                }
            }
        }
    }
}

@Composable
private fun QwertyKeyRow(
    keys: List<String>,
    shiftActive: Boolean,
    onKey: (String) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(3.dp)
    ) {
        keys.forEach { key ->
            val shown = if (shiftActive && key.length == 1 && key[0].isLetter()) key.uppercase() else key.lowercase()
            QwertyKeyButton(label = shown, modifier = Modifier.weight(1f)) { onKey(key) }
        }
    }
}

@Composable
private fun QwertyKeyButton(
    label: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(5.dp),
        color = Color(0xFF1E293B),
        border = BorderStroke(1.dp, Color(0xFF334155)),
        modifier = modifier
            .height(34.dp)
            .clickable { onClick() }
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(text = label, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
private fun QwertyActionChip(
    label: String,
    active: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(5.dp),
        color = if (active) Color(0xFF0078D4) else Color(0xFF141D2E),
        border = BorderStroke(1.dp, if (active) Color(0xFF38BDF8) else Color(0xFF334155)),
        modifier = modifier
            .height(34.dp)
            .clickable { onClick() }
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                text = label,
                color = Color.White,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                fontFamily = FontFamily.Monospace
            )
        }
    }
}

/**
 * Authentic JoiPlay-style Virtual Controller Overlay supporting PlayStation (△ ○ × □) and Nintendo (X A B Y) skins.
 * Includes D-Pad cross, L-Stick (WASD), R-Stick (mouse/camera relative look), L1/L2, R1/R2, Select, Start.
 */
@Composable
fun JoiPlayGamepadOverlay(
    preset: InputOverlayPreset,
    onDispatchKey: (key: String, ctrl: Boolean, alt: Boolean, shift: Boolean) -> Unit,
    onMovePointer: (dx: Float, dy: Float) -> Unit,
    modifier: Modifier = Modifier
) {
    var boxSize by remember { mutableStateOf(IntSize.Zero) }
    val density = LocalDensity.current
    val alpha = preset.opacity.coerceIn(0.35f, 0.95f)

    Box(
        modifier = modifier
            .fillMaxSize()
            .onSizeChanged { boxSize = it }
    ) {
        if (boxSize.width > 0 && boxSize.height > 0) {
            preset.buttons.filter { it.visible }.forEach { spec ->
                val sizePx = with(density) { spec.sizeDp.dp.toPx() }
                val xPx = (spec.xRatio * boxSize.width - sizePx / 2f).roundToInt()
                    .coerceIn(0, (boxSize.width - sizePx.roundToInt()).coerceAtLeast(0))
                val yPx = (spec.yRatio * boxSize.height - sizePx / 2f).roundToInt()
                    .coerceIn(0, (boxSize.height - sizePx.roundToInt()).coerceAtLeast(0))

                Box(
                    modifier = Modifier
                        .offset { IntOffset(xPx, yPx) }
                        .size(spec.sizeDp.dp)
                ) {
                    when (spec.id) {
                        "dpad" -> JoiPlayCrossDpad(alpha = alpha, onDirection = { dir ->
                            onDispatchKey(dir, false, false, false)
                        })
                        "lstick" -> JoiPlayThumbStick(
                            label = "L",
                            alpha = alpha,
                            onVector = { vx, vy ->
                                if (vx < -0.45f) onDispatchKey("A", false, false, false)
                                else if (vx > 0.45f) onDispatchKey("D", false, false, false)
                                if (vy < -0.45f) onDispatchKey("W", false, false, false)
                                else if (vy > 0.45f) onDispatchKey("S", false, false, false)
                            }
                        )
                        "rstick" -> JoiPlayThumbStick(
                            label = "R",
                            alpha = alpha,
                            onVector = { vx, vy ->
                                onMovePointer(vx * 14f, vy * 14f)
                            }
                        )
                        else -> JoiPlayFaceOrShoulderButton(
                            spec = spec,
                            skin = preset.skin,
                            alpha = alpha,
                            onPress = { onDispatchKey(spec.mappedKey, false, false, false) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun JoiPlayCrossDpad(
    alpha: Float,
    onDirection: (String) -> Unit
) {
    Box(modifier = Modifier.fillMaxSize()) {
        // Vertical bar
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            DpadCell("↑", alpha, Modifier.fillMaxWidth(0.36f).weight(1f)) { onDirection("UP") }
            Spacer(modifier = Modifier.weight(0.9f))
            DpadCell("↓", alpha, Modifier.fillMaxWidth(0.36f).weight(1f)) { onDirection("DOWN") }
        }
        // Horizontal bar
        Row(
            modifier = Modifier.fillMaxSize(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            DpadCell("←", alpha, Modifier.fillMaxHeight(0.36f).weight(1f)) { onDirection("LEFT") }
            Box(
                modifier = Modifier
                    .fillMaxHeight(0.36f)
                    .weight(0.9f)
                    .background(Color(0xFF0F172A).copy(alpha = alpha), RoundedCornerShape(4.dp))
            )
            DpadCell("→", alpha, Modifier.fillMaxHeight(0.36f).weight(1f)) { onDirection("RIGHT") }
        }
    }
}

@Composable
private fun DpadCell(symbol: String, alpha: Float, modifier: Modifier, onClick: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(7.dp),
        color = Color(0xFF0F172A).copy(alpha = alpha),
        border = BorderStroke(1.dp, Color(0xFF475569).copy(alpha = alpha)),
        modifier = modifier.clickable { onClick() }
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(text = symbol, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun JoiPlayThumbStick(
    label: String,
    alpha: Float,
    onVector: (Float, Float) -> Unit
) {
    var knobX by remember { mutableFloatStateOf(0f) }
    var knobY by remember { mutableFloatStateOf(0f) }

    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .fillMaxSize()
            .clip(CircleShape)
            .background(Color(0xFF0F172A).copy(alpha = alpha * 0.65f))
            .border(1.5.dp, Color(0xFF475569).copy(alpha = alpha), CircleShape)
            .pointerInput(Unit) {
                val maxR = size.width * 0.30f
                detectDragGestures(
                    onDragEnd = {
                        knobX = 0f
                        knobY = 0f
                    },
                    onDragCancel = {
                        knobX = 0f
                        knobY = 0f
                    }
                ) { change, dragAmount ->
                    change.consume()
                    val nx = knobX + dragAmount.x
                    val ny = knobY + dragAmount.y
                    val dist = hypot(nx, ny).coerceAtLeast(0.001f)
                    val clamped = dist.coerceAtMost(maxR)
                    knobX = nx / dist * clamped
                    knobY = ny / dist * clamped
                    onVector((knobX / maxR).coerceIn(-1f, 1f), (knobY / maxR).coerceIn(-1f, 1f))
                }
            }
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .offset { IntOffset(knobX.roundToInt(), knobY.roundToInt()) }
                .fillMaxSize(0.52f)
                .clip(CircleShape)
                .background(Color(0xFF1E293B).copy(alpha = alpha))
                .border(1.5.dp, Color(0xFF38BDF8).copy(alpha = alpha), CircleShape)
        ) {
            Text(label, color = Color(0xFFCBD5E1), fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun JoiPlayFaceOrShoulderButton(
    spec: GamepadButtonSpec,
    skin: GamepadSkin,
    alpha: Float,
    onPress: () -> Unit
) {
    val isShoulderOrSys = spec.id in setOf("l1", "l2", "r1", "r2", "select", "start")
    val accentColor = when (spec.id) {
        "btn-top" -> if (skin == GamepadSkin.PLAYSTATION) Color(0xFF34D399) else Color(0xFF60A5FA)
        "btn-right" -> if (skin == GamepadSkin.PLAYSTATION) Color(0xFFFB7185) else Color(0xFFF87171)
        "btn-bottom" -> if (skin == GamepadSkin.PLAYSTATION) Color(0xFF38BDF8) else Color(0xFFFBBF24)
        "btn-left" -> if (skin == GamepadSkin.PLAYSTATION) Color(0xFFF472B6) else Color(0xFF34D399)
        else -> Color(0xFFCBD5E1)
    }

    val shape = if (isShoulderOrSys) RoundedCornerShape(10.dp) else CircleShape
    Surface(
        shape = shape,
        color = Color(0xFF0F172A).copy(alpha = alpha),
        border = BorderStroke(1.5.dp, accentColor.copy(alpha = alpha * 0.85f)),
        modifier = Modifier
            .fillMaxSize()
            .clickable { onPress() }
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(2.dp)) {
            Text(
                text = spec.label,
                color = accentColor,
                fontSize = if (isShoulderOrSys) 11.sp else 16.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
        }
    }
}

/**
 * Interactive Keypad & JoiPlay Gamepad Studio rendered directly over a Windows Desktop + Wine Notepad GUI reference.
 * Users can drag buttons in place, switch PlayStation/Nintendo skin, customize mapped keys/size/visibility,
 * toggle Unified QWERTY, toggle individual Desktop Keys, and adjust opacity.
 */
@Composable
fun InputLayoutEditorCanvas(
    preset: InputOverlayPreset,
    onUpdatePreset: (InputOverlayPreset) -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedButtonId by remember(preset.id) {
        mutableStateOf(preset.buttons.firstOrNull()?.id ?: "btn-bottom")
    }
    var previewOverlayMode by remember { mutableStateOf("gamepad") } // "gamepad" | "keyboard"
    var canvasSize by remember { mutableStateOf(IntSize.Zero) }
    val density = LocalDensity.current

    val allCandidateDesktopKeys = remember {
        listOf(
            "ESC", "TAB", "CTRL", "ALT", "SHIFT", "WIN",
            "F1", "F2", "F3", "F4", "F5", "F8", "F11", "F12",
            "DEL", "INS", "HOME", "END", "PGUP", "PGDN", "←", "↑", "↓", "→"
        )
    }
    val keyBindingOptions = remember {
        listOf("SPACE", "ENTER", "ESC", "TAB", "SHIFT", "CTRL", "ALT", "W", "A", "S", "D", "E", "Q", "R", "Z", "X", "ARROWS", "WASD", "MOUSE")
    }

    val selectedBtn = preset.buttons.firstOrNull { it.id == selectedButtonId }

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Top Toolbar: Skin + Mode + Reset
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                FilterChip(
                    selected = previewOverlayMode == "gamepad",
                    onClick = { previewOverlayMode = "gamepad" },
                    label = { Text("JoiPlay Pad") }
                )
                FilterChip(
                    selected = previewOverlayMode == "keyboard",
                    onClick = { previewOverlayMode = "keyboard" },
                    label = { Text("Unified QWERTY") }
                )
            }
            OutlinedButton(
                onClick = {
                    val reset = InputOverlayPreset(
                        skin = preset.skin,
                        buttons = InputOverlayPreset.defaultJoiPlayButtons(preset.skin)
                    )
                    onUpdatePreset(reset)
                }
            ) {
                Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text("Reset")
            }
        }

        // Skin & Opacity Card
        OutlinedCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Gamepad Style (JoiPlay)", style = MaterialTheme.typography.titleSmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterChip(
                            selected = preset.skin == GamepadSkin.PLAYSTATION,
                            onClick = {
                                val nextButtons = preset.buttons.map { b ->
                                    when (b.id) {
                                        "btn-top" -> b.copy(label = "△")
                                        "btn-right" -> b.copy(label = "○")
                                        "btn-bottom" -> b.copy(label = "×")
                                        "btn-left" -> b.copy(label = "□")
                                        else -> b
                                    }
                                }
                                onUpdatePreset(preset.copy(skin = GamepadSkin.PLAYSTATION, buttons = nextButtons))
                            },
                            label = { Text("PlayStation (△○×□)") }
                        )
                        FilterChip(
                            selected = preset.skin == GamepadSkin.NINTENDO,
                            onClick = {
                                val nextButtons = preset.buttons.map { b ->
                                    when (b.id) {
                                        "btn-top" -> b.copy(label = "X")
                                        "btn-right" -> b.copy(label = "A")
                                        "btn-bottom" -> b.copy(label = "B")
                                        "btn-left" -> b.copy(label = "Y")
                                        else -> b
                                    }
                                }
                                onUpdatePreset(preset.copy(skin = GamepadSkin.NINTENDO, buttons = nextButtons))
                            },
                            label = { Text("Nintendo (XABY)") }
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Include Integrated QWERTY", style = MaterialTheme.typography.bodySmall)
                    Switch(
                        checked = preset.qwertyEnabled,
                        onCheckedChange = { onUpdatePreset(preset.copy(qwertyEnabled = it)) }
                    )
                }

                Column {
                    Text(
                        "Overlay Opacity: ${(preset.opacity * 100).roundToInt()}%",
                        style = MaterialTheme.typography.bodySmall,
                        fontFamily = FontFamily.Monospace
                    )
                    Slider(
                        value = preset.opacity,
                        onValueChange = { onUpdatePreset(preset.copy(opacity = it.coerceIn(0.35f, 0.96f))) },
                        valueRange = 0.35f..0.96f
                    )
                }
            }
        }

        // Desktop GUI Reference Backdrop + Draggable Controls
        Text(
            "Desktop GUI Reference Preview (Drag buttons directly over Windows Notepad)",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.primary
        )

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
                .clip(RoundedCornerShape(10.dp))
                .background(Color(0xFF0A192F))
                .border(1.dp, Color(0xFF334155), RoundedCornerShape(10.dp))
                .onSizeChanged { canvasSize = it }
        ) {
            // Simulated Windows Desktop + Wine Notepad window mockup
            Column(modifier = Modifier.fillMaxSize()) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .padding(12.dp)
                ) {
                    // Mock Notepad Window
                    Column(
                        modifier = Modifier
                            .align(Alignment.Center)
                            .fillMaxWidth(0.72f)
                            .fillMaxHeight(0.84f)
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color(0xFF1E293B))
                            .border(1.dp, Color(0xFF475569), RoundedCornerShape(6.dp))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color(0xFF0F172A))
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Untitled - Wine Notepad", color = Color(0xFFE2E8F0), fontSize = 10.sp)
                            Text("─  □  ✕", color = Color(0xFF94A3B8), fontSize = 10.sp)
                        }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color(0xFF162032))
                                .padding(horizontal = 8.dp, vertical = 2.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text("File  Edit  Format  View  Help", color = Color(0xFF94A3B8), fontSize = 9.sp)
                        }
                        Text(
                            "C:\\windows\\system32\\notepad.exe\nReady for WPhone Unified Keyboard or JoiPlay Pad...",
                            color = Color(0xFFCBD5E1),
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            modifier = Modifier.padding(8.dp)
                        )
                    }
                }
                // Mock Windows Taskbar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(22.dp)
                        .background(Color(0xFF020617).copy(alpha = 0.9f))
                        .padding(horizontal = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("⊞  Start  |  Notepad", color = Color(0xFF94A3B8), fontSize = 9.sp)
                    Text("12:00 PM", color = Color(0xFF94A3B8), fontSize = 9.sp, fontFamily = FontFamily.Monospace)
                }
            }

            // Overlay either Draggable JoiPlay Pad OR Unified Keyboard Preview
            if (previewOverlayMode == "keyboard") {
                UnifiedQwertyDesktopKeyboard(
                    preset = preset,
                    onDispatchKey = { _, _, _, _ -> },
                    onOpenSystemIme = {},
                    onHide = {},
                    modifier = Modifier.align(Alignment.BottomCenter)
                )
            } else if (canvasSize.width > 0 && canvasSize.height > 0) {
                preset.buttons.forEach { spec ->
                    val scaledDp = (spec.sizeDp * 0.72f).coerceIn(28f, 84f)
                    val sizePx = with(density) { scaledDp.dp.toPx() }
                    val xPx = (spec.xRatio * canvasSize.width - sizePx / 2f).roundToInt()
                        .coerceIn(0, (canvasSize.width - sizePx.roundToInt()).coerceAtLeast(0))
                    val yPx = (spec.yRatio * canvasSize.height - sizePx / 2f).roundToInt()
                        .coerceIn(0, (canvasSize.height - sizePx.roundToInt()).coerceAtLeast(0))
                    val isSelected = spec.id == selectedButtonId

                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .offset { IntOffset(xPx, yPx) }
                            .size(scaledDp.dp)
                            .clip(if (spec.id in setOf("l1", "l2", "r1", "r2", "select", "start")) RoundedCornerShape(7.dp) else CircleShape)
                            .background(
                                Color(0xFF0F172A).copy(alpha = if (spec.visible) preset.opacity else 0.25f)
                            )
                            .border(
                                width = if (isSelected) 2.dp else 1.dp,
                                color = if (isSelected) Color(0xFF38BDF8) else Color(0xFF64748B),
                                shape = if (spec.id in setOf("l1", "l2", "r1", "r2", "select", "start")) RoundedCornerShape(7.dp) else CircleShape
                            )
                            .clickable { selectedButtonId = spec.id }
                            .pointerInput(spec.id, canvasSize) {
                                detectDragGestures { change, dragAmount ->
                                    change.consume()
                                    selectedButtonId = spec.id
                                    val dxRatio = dragAmount.x / canvasSize.width.toFloat().coerceAtLeast(1f)
                                    val dyRatio = dragAmount.y / canvasSize.height.toFloat().coerceAtLeast(1f)
                                    val nextButtons = preset.buttons.map { item ->
                                        if (item.id == spec.id) {
                                            item.copy(
                                                xRatio = (item.xRatio + dxRatio).coerceIn(0.05f, 0.95f),
                                                yRatio = (item.yRatio + dyRatio).coerceIn(0.08f, 0.92f)
                                            )
                                        } else item
                                    }
                                    onUpdatePreset(preset.copy(buttons = nextButtons))
                                }
                            }
                    ) {
                        Text(
                            text = spec.label,
                            color = if (spec.visible) Color.White else Color(0xFF64748B),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        }

        // Selected Gamepad Control Inspector
        selectedBtn?.let { btn ->
            OutlinedCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Control: ${btn.label} (${btn.id})", style = MaterialTheme.typography.titleSmall)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("Visible", style = MaterialTheme.typography.bodySmall)
                            Spacer(Modifier.width(6.dp))
                            Switch(
                                checked = btn.visible,
                                onCheckedChange = { vis ->
                                    onUpdatePreset(
                                        preset.copy(buttons = preset.buttons.map { if (it.id == btn.id) it.copy(visible = vis) else it })
                                    )
                                }
                            )
                        }
                    }
                    Text("Button Size: ${btn.sizeDp.roundToInt()} dp", style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace)
                    Slider(
                        value = btn.sizeDp,
                        onValueChange = { sz ->
                            onUpdatePreset(
                                preset.copy(buttons = preset.buttons.map { if (it.id == btn.id) it.copy(sizeDp = sz) else it })
                            )
                        },
                        valueRange = 36f..132f
                    )
                    Text("Mapped Windows Key:", style = MaterialTheme.typography.bodySmall)
                    Row(
                        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        keyBindingOptions.forEach { keyOpt ->
                            FilterChip(
                                selected = btn.mappedKey.equals(keyOpt, ignoreCase = true),
                                onClick = {
                                    onUpdatePreset(
                                        preset.copy(buttons = preset.buttons.map { if (it.id == btn.id) it.copy(mappedKey = keyOpt) else it })
                                    )
                                },
                                label = { Text(keyOpt, fontFamily = FontFamily.Monospace) }
                            )
                        }
                    }
                }
            }
        }

        // Customizable Desktop Keys Strip
        OutlinedCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Customize Desktop Strip Keys (${preset.desktopKeys.size} active)", style = MaterialTheme.typography.titleSmall)
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    allCandidateDesktopKeys.forEach { candidate ->
                        val enabled = preset.desktopKeys.contains(candidate)
                        FilterChip(
                            selected = enabled,
                            onClick = {
                                val next = if (enabled) {
                                    preset.desktopKeys.filterNot { it == candidate }.ifEmpty { listOf("ESC") }
                                } else {
                                    preset.desktopKeys + candidate
                                }
                                onUpdatePreset(preset.copy(desktopKeys = next))
                            },
                            label = { Text(candidate, fontFamily = FontFamily.Monospace) }
                        )
                    }
                }
            }
        }
    }
}
