package id.wphone

import android.content.Context
import android.graphics.SurfaceTexture
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.Surface
import android.view.TextureView
import android.view.inputmethod.BaseInputConnection
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import kotlin.math.abs

object XKeyMapper {
    private const val MASK_SHIFT = 1 shl 0
    private const val MASK_CTRL = 1 shl 2
    private const val MASK_ALT = 1 shl 3

    fun mapLabelToX11Keycode(label: String): Int? = when (label.uppercase()) {
        "ESC" -> 9
        "TAB" -> 23
        "CTRL" -> 37
        "ALT" -> 64
        "SHIFT", "LSHIFT" -> 50
        "WIN", "META", "SUPER" -> 133
        "SPACE" -> 65
        "ENTER", "RETURN" -> 36
        "BACKSPACE" -> 22
        "DEL", "DELETE" -> 119
        "INS", "INSERT" -> 118
        "HOME" -> 110
        "END" -> 115
        "PGUP" -> 112
        "PGDN" -> 117
        "↑", "UP" -> 111
        "↓", "DOWN" -> 116
        "←", "LEFT" -> 113
        "→", "RIGHT" -> 114
        "-" -> 20
        "=" -> 21
        "[" -> 34
        "]" -> 35
        ";" -> 47
        "'" -> 48
        "`" -> 49
        "\\" -> 51
        "," -> 59
        "." -> 60
        "/" -> 61
        "F1" -> 67
        "F2" -> 68
        "F3" -> 69
        "F4" -> 70
        "F5" -> 71
        "F6" -> 72
        "F7" -> 73
        "F8" -> 74
        "F9" -> 75
        "F10" -> 76
        "F11" -> 95
        "F12" -> 96
        "1" -> 10; "2" -> 11; "3" -> 12; "4" -> 13; "5" -> 14
        "6" -> 15; "7" -> 16; "8" -> 17; "9" -> 18; "0" -> 19
        "Q" -> 24; "W" -> 25; "E" -> 26; "R" -> 27; "T" -> 28; "Y" -> 29; "U" -> 30; "I" -> 31; "O" -> 32; "P" -> 33
        "A" -> 38; "S" -> 39; "D" -> 40; "F" -> 41; "G" -> 42; "H" -> 43; "J" -> 44; "K" -> 45; "L" -> 46
        "Z" -> 52; "X" -> 53; "C" -> 54; "V" -> 55; "B" -> 56; "N" -> 57; "M" -> 58
        else -> null
    }

    fun mapAndroidKeyCode(keyCode: Int): Int? = when (keyCode) {
        KeyEvent.KEYCODE_ESCAPE -> 9
        KeyEvent.KEYCODE_TAB -> 23
        KeyEvent.KEYCODE_DEL -> 22
        KeyEvent.KEYCODE_FORWARD_DEL -> 119
        KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER -> 36
        KeyEvent.KEYCODE_SPACE -> 65
        KeyEvent.KEYCODE_DPAD_UP -> 111
        KeyEvent.KEYCODE_DPAD_DOWN -> 116
        KeyEvent.KEYCODE_DPAD_LEFT -> 113
        KeyEvent.KEYCODE_DPAD_RIGHT -> 114
        KeyEvent.KEYCODE_MOVE_HOME -> 110
        KeyEvent.KEYCODE_MOVE_END -> 115
        KeyEvent.KEYCODE_PAGE_UP -> 112
        KeyEvent.KEYCODE_PAGE_DOWN -> 117
        KeyEvent.KEYCODE_INSERT -> 118
        KeyEvent.KEYCODE_CTRL_LEFT, KeyEvent.KEYCODE_CTRL_RIGHT -> 37
        KeyEvent.KEYCODE_ALT_LEFT, KeyEvent.KEYCODE_ALT_RIGHT -> 64
        KeyEvent.KEYCODE_SHIFT_LEFT, KeyEvent.KEYCODE_SHIFT_RIGHT -> 50
        KeyEvent.KEYCODE_META_LEFT, KeyEvent.KEYCODE_META_RIGHT -> 133
        KeyEvent.KEYCODE_MINUS -> 20
        KeyEvent.KEYCODE_EQUALS -> 21
        KeyEvent.KEYCODE_LEFT_BRACKET -> 34
        KeyEvent.KEYCODE_RIGHT_BRACKET -> 35
        KeyEvent.KEYCODE_SEMICOLON -> 47
        KeyEvent.KEYCODE_APOSTROPHE -> 48
        KeyEvent.KEYCODE_GRAVE -> 49
        KeyEvent.KEYCODE_BACKSLASH -> 51
        KeyEvent.KEYCODE_COMMA -> 59
        KeyEvent.KEYCODE_PERIOD -> 60
        KeyEvent.KEYCODE_SLASH -> 61
        in KeyEvent.KEYCODE_0..KeyEvent.KEYCODE_9 -> {
            if (keyCode == KeyEvent.KEYCODE_0) 19 else 10 + (keyCode - KeyEvent.KEYCODE_1)
        }
        in KeyEvent.KEYCODE_A..KeyEvent.KEYCODE_Z -> {
            val ch = ('A'.code + (keyCode - KeyEvent.KEYCODE_A)).toChar().toString()
            mapLabelToX11Keycode(ch)
        }
        in KeyEvent.KEYCODE_F1..KeyEvent.KEYCODE_F10 -> 67 + (keyCode - KeyEvent.KEYCODE_F1)
        KeyEvent.KEYCODE_F11 -> 95
        KeyEvent.KEYCODE_F12 -> 96
        else -> null
    }

    fun dispatchVirtualCombo(label: String, ctrl: Boolean, alt: Boolean, shift: Boolean) {
        val code = mapLabelToX11Keycode(label) ?: return
        var mask = 0
        if (shift) {
            mask = mask or MASK_SHIFT
            WPhoneNativeBridge.xserverInjectKey(50, true, mask)
        }
        if (ctrl) {
            mask = mask or MASK_CTRL
            WPhoneNativeBridge.xserverInjectKey(37, true, mask)
        }
        if (alt) {
            mask = mask or MASK_ALT
            WPhoneNativeBridge.xserverInjectKey(64, true, mask)
        }

        WPhoneNativeBridge.xserverInjectKey(code, true, mask)
        WPhoneNativeBridge.xserverInjectKey(code, false, mask)

        if (alt) WPhoneNativeBridge.xserverInjectKey(64, false, 0)
        if (ctrl) WPhoneNativeBridge.xserverInjectKey(37, false, 0)
        if (shift) WPhoneNativeBridge.xserverInjectKey(50, false, 0)
    }
}

/**
 * Uses TextureView (rather than SurfaceView) so Jetpack Compose HUD controls (Exit button, Mini Monitor,
 * Unified Keyboard, and JoiPlay Gamepad) always composite reliably above the X11 desktop on Android 7.0+.
 */
class XServerSurfaceView(
    context: Context,
    private var fbWidth: Int,
    private var fbHeight: Int
) : TextureView(context), TextureView.SurfaceTextureListener {

    var trackpadMode: Boolean = false

    private var activeSurface: Surface? = null
    private var cursorX: Float = fbWidth / 2f
    private var cursorY: Float = fbHeight / 2f
    private var lastTouchX: Float = 0f
    private var lastTouchY: Float = 0f
    private var downTouchX: Float = 0f
    private var downTouchY: Float = 0f
    private var leftButtonPressed: Boolean = false
    private var longPressTriggered: Boolean = false
    private var movedTooFarForTap: Boolean = false

    private val handler = Handler(Looper.getMainLooper())
    private val longPressRunnable = Runnable {
        if (!movedTooFarForTap && !trackpadMode) {
            longPressTriggered = true
            if (leftButtonPressed) {
                WPhoneNativeBridge.xserverInjectPointer(cursorX.toInt(), cursorY.toInt(), 1, 2, 0)
                leftButtonPressed = false
            }
            WPhoneNativeBridge.xserverInjectPointer(cursorX.toInt(), cursorY.toInt(), 3, 1, 0)
            WPhoneNativeBridge.xserverInjectPointer(cursorX.toInt(), cursorY.toInt(), 3, 2, 0)
        }
    }

    init {
        isFocusable = true
        isFocusableInTouchMode = true
        isOpaque = true
        surfaceTextureListener = this
    }

    fun updateVirtualResolution(width: Int, height: Int) {
        fbWidth = width.coerceAtLeast(320)
        fbHeight = height.coerceAtLeast(240)
        cursorX = cursorX.coerceIn(0f, (fbWidth - 1).toFloat())
        cursorY = cursorY.coerceIn(0f, (fbHeight - 1).toFloat())
    }

    fun moveRelativePointer(dx: Float, dy: Float) {
        cursorX = (cursorX + dx).coerceIn(0f, (fbWidth - 1).toFloat())
        cursorY = (cursorY + dy).coerceIn(0f, (fbHeight - 1).toFloat())
        WPhoneNativeBridge.xserverInjectPointer(cursorX.toInt(), cursorY.toInt(), 0, 0, 0)
    }

    override fun onSurfaceTextureAvailable(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
        activeSurface?.release()
        activeSurface = Surface(surfaceTexture)
        WPhoneNativeBridge.xserverSetSurface(activeSurface)
    }

    override fun onSurfaceTextureSizeChanged(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
        WPhoneNativeBridge.xserverSetSurface(activeSurface)
    }

    override fun onSurfaceTextureDestroyed(surfaceTexture: SurfaceTexture): Boolean {
        handler.removeCallbacks(longPressRunnable)
        WPhoneNativeBridge.xserverSetSurface(null)
        activeSurface?.release()
        activeSurface = null
        return true
    }

    override fun onSurfaceTextureUpdated(surfaceTexture: SurfaceTexture) = Unit

    override fun onCheckIsTextEditor(): Boolean = true

    override fun onCreateInputConnection(outAttrs: EditorInfo): InputConnection {
        outAttrs.imeOptions = EditorInfo.IME_FLAG_NO_EXTRACT_UI or EditorInfo.IME_ACTION_NONE
        outAttrs.inputType = android.text.InputType.TYPE_CLASS_TEXT
        return object : BaseInputConnection(this, false) {
            override fun commitText(text: CharSequence?, newCursorPosition: Int): Boolean {
                text?.forEach { ch ->
                    dispatchTypedChar(ch)
                }
                return true
            }

            override fun deleteSurroundingText(beforeLength: Int, afterLength: Int): Boolean {
                repeat(beforeLength.coerceAtLeast(1)) {
                    XKeyMapper.dispatchVirtualCombo("BACKSPACE", ctrl = false, alt = false, shift = false)
                }
                return true
            }
        }
    }

    private fun dispatchTypedChar(ch: Char) {
        when (ch) {
            '\n' -> XKeyMapper.dispatchVirtualCombo("ENTER", ctrl = false, alt = false, shift = false)
            '\t' -> XKeyMapper.dispatchVirtualCombo("TAB", ctrl = false, alt = false, shift = false)
            ' ' -> XKeyMapper.dispatchVirtualCombo("SPACE", ctrl = false, alt = false, shift = false)
            else -> {
                val upper = ch.uppercaseChar()
                val label = upper.toString()
                val needsShift = ch.isUpperCase()
                if (XKeyMapper.mapLabelToX11Keycode(label) != null) {
                    XKeyMapper.dispatchVirtualCombo(label, ctrl = false, alt = false, shift = needsShift)
                }
            }
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        val xCode = XKeyMapper.mapAndroidKeyCode(keyCode) ?: return super.onKeyDown(keyCode, event)
        var mask = 0
        if (event.isShiftPressed) mask = mask or 1
        if (event.isCtrlPressed) mask = mask or 4
        if (event.isAltPressed) mask = mask or 8
        WPhoneNativeBridge.xserverInjectKey(xCode, true, mask)
        return true
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
        val xCode = XKeyMapper.mapAndroidKeyCode(keyCode) ?: return super.onKeyUp(keyCode, event)
        WPhoneNativeBridge.xserverInjectKey(xCode, false, 0)
        return true
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        val viewW = width.coerceAtLeast(1).toFloat()
        val viewH = height.coerceAtLeast(1).toFloat()

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                requestFocus()
                lastTouchX = event.x
                lastTouchY = event.y
                downTouchX = event.x
                downTouchY = event.y
                movedTooFarForTap = false
                longPressTriggered = false

                if (!trackpadMode) {
                    cursorX = ((event.x / viewW) * fbWidth).coerceIn(0f, (fbWidth - 1).toFloat())
                    cursorY = ((event.y / viewH) * fbHeight).coerceIn(0f, (fbHeight - 1).toFloat())
                    WPhoneNativeBridge.xserverInjectPointer(cursorX.toInt(), cursorY.toInt(), 1, 0, 0)
                    WPhoneNativeBridge.xserverInjectPointer(cursorX.toInt(), cursorY.toInt(), 1, 1, 0)
                    leftButtonPressed = true
                    handler.postDelayed(longPressRunnable, 550L)
                }
                return true
            }

            MotionEvent.ACTION_POINTER_DOWN -> {
                handler.removeCallbacks(longPressRunnable)
                if (event.pointerCount == 2) {
                    if (leftButtonPressed) {
                        WPhoneNativeBridge.xserverInjectPointer(cursorX.toInt(), cursorY.toInt(), 1, 2, 0)
                        leftButtonPressed = false
                    }
                    WPhoneNativeBridge.xserverInjectPointer(cursorX.toInt(), cursorY.toInt(), 3, 1, 0)
                    WPhoneNativeBridge.xserverInjectPointer(cursorX.toInt(), cursorY.toInt(), 3, 2, 0)
                    longPressTriggered = true
                }
                return true
            }

            MotionEvent.ACTION_MOVE -> {
                if (abs(event.x - downTouchX) > 14f || abs(event.y - downTouchY) > 14f) {
                    movedTooFarForTap = true
                    handler.removeCallbacks(longPressRunnable)
                }
                if (trackpadMode) {
                    val dx = (event.x - lastTouchX) * (fbWidth / viewW) * 1.35f
                    val dy = (event.y - lastTouchY) * (fbHeight / viewH) * 1.35f
                    cursorX = (cursorX + dx).coerceIn(0f, (fbWidth - 1).toFloat())
                    cursorY = (cursorY + dy).coerceIn(0f, (fbHeight - 1).toFloat())
                    WPhoneNativeBridge.xserverInjectPointer(cursorX.toInt(), cursorY.toInt(), 0, 0, 0)
                } else {
                    cursorX = ((event.x / viewW) * fbWidth).coerceIn(0f, (fbWidth - 1).toFloat())
                    cursorY = ((event.y / viewH) * fbHeight).coerceIn(0f, (fbHeight - 1).toFloat())
                    val mods = if (leftButtonPressed) (1 shl 8) else 0
                    WPhoneNativeBridge.xserverInjectPointer(cursorX.toInt(), cursorY.toInt(), 1, 0, mods)
                }
                lastTouchX = event.x
                lastTouchY = event.y
                return true
            }

            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                handler.removeCallbacks(longPressRunnable)
                if (trackpadMode) {
                    if (!movedTooFarForTap && !longPressTriggered) {
                        WPhoneNativeBridge.xserverInjectPointer(cursorX.toInt(), cursorY.toInt(), 1, 1, 0)
                        WPhoneNativeBridge.xserverInjectPointer(cursorX.toInt(), cursorY.toInt(), 1, 2, 0)
                    }
                } else if (leftButtonPressed) {
                    WPhoneNativeBridge.xserverInjectPointer(cursorX.toInt(), cursorY.toInt(), 1, 2, 0)
                    leftButtonPressed = false
                }
                return true
            }
        }
        return super.onTouchEvent(event)
    }
}
