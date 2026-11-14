package id.wphone.core.prefix

import id.wphone.core.config.WinArch
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

class PrefixManagerTest {
    @Test
    fun registryHiveRoundTripPreservesDllOverrides() {
        val hive = WineRegistryHive(
            winVersion = "win7",
            audioDriver = "pulse",
            directDrawRenderer = "opengl",
            videoMemoryMb = 256,
            csmtEnabled = false,
            dllOverrides = linkedMapOf(
                "msvcp140" to DllOverrideMode.NATIVE_BUILTIN,
                "d3d11" to DllOverrideMode.BUILTIN_ONLY
            )
        )
        val serialized = hive.serializeUserReg("TestApp")
        val parsed = WineRegistryHive.parseUserReg(serialized)

        assertEquals("win7", parsed.winVersion)
        assertEquals(256, parsed.videoMemoryMb)
        assertEquals(false, parsed.csmtEnabled)
        assertEquals(DllOverrideMode.NATIVE_BUILTIN, parsed.dllOverrides["msvcp140"])
        assertEquals(DllOverrideMode.BUILTIN_ONLY, parsed.dllOverrides["d3d11"])
        assertEquals("msvcp140=n,b;d3d11=b", parsed.toWineDllOverridesEnv())
    }

    @Test
    fun peInspectorDetectsX64PeBinary() {
        val tmp = File.createTempFile("wphone_test_", ".exe")
        try {
            val buf = ByteArray(256)
            buf[0] = 'M'.code.toByte()
            buf[1] = 'Z'.code.toByte()
            val bb = ByteBuffer.wrap(buf).order(ByteOrder.LITTLE_ENDIAN)
            bb.putInt(0x3C, 0x80)
            buf[0x80] = 'P'.code.toByte()
            buf[0x81] = 'E'.code.toByte()
            bb.putShort(0x84, 0x8664.toShort())
            bb.putShort(0x80 + 24, 0x020B.toShort())
            bb.putShort(0x80 + 24 + 68, 2.toShort())
            tmp.writeBytes(buf)

            val res = PeHeaderInspector.inspect(tmp)
            assertTrue(res.validPe)
            assertEquals(WinArch.X64, res.arch)
            assertTrue(res.isPe32Plus)
            assertEquals("Windows GUI", res.subsystem)
        } finally {
            tmp.delete()
        }
    }
}
