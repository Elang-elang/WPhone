package id.wphone.core.input

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Dual Desktop / Gaming keyboard overlay bar layered above Android IME.
 * Lightweight Compose layout without heavy animations for Android 7.0+ (API 24+).
 */
@Composable
fun DesktopModifierBar(
    keys: List<String> = listOf(
        "ESC", "TAB", "CTRL", "ALT", "SHIFT", "META",
        "F1", "F2", "F5", "F11", "F12",
        "HOME", "END", "PGUP", "PGDN", "INS", "DEL"
    ),
    alphaLevel: Float = 0.92f,
    onDispatchKey: (key: String, ctrl: Boolean, alt: Boolean, shift: Boolean) -> Unit
) {
    var stickyCtrl by remember { mutableStateOf(false) }
    var stickyAlt by remember { mutableStateOf(false) }
    var stickyShift by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF0F172A).copy(alpha = alphaLevel))
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 8.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        keys.forEach { key ->
            val isActive = (key == "CTRL" && stickyCtrl) ||
                (key == "ALT" && stickyAlt) ||
                (key == "SHIFT" && stickyShift)
            Surface(
                shape = RoundedCornerShape(6.dp),
                color = if (isActive) Color(0xFF0078D4) else Color(0xFF1E293B),
                modifier = Modifier
                    .defaultMinSize(minWidth = 44.dp, minHeight = 40.dp)
                    .clickable {
                        when (key) {
                            "CTRL" -> stickyCtrl = !stickyCtrl
                            "ALT" -> stickyAlt = !stickyAlt
                            "SHIFT" -> stickyShift = !stickyShift
                            else -> {
                                onDispatchKey(key, stickyCtrl, stickyAlt, stickyShift)
                                stickyCtrl = false
                                stickyAlt = false
                                stickyShift = false
                            }
                        }
                    }
            ) {
                Box(modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp)) {
                    Text(
                        text = key,
                        style = MaterialTheme.typography.labelMedium,
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
    alphaLevel: Float = 0.85f,
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
