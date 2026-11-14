package id.wphone.core.config

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ConfigModelTest {
    @Test
    fun legacySubAndroid10BudgetFlagsAreConsistent() {
        val budget = LegacyMemoryBudget(
            isSubAndroid10 = true,
            isLowRamMode = true,
            maxVirtualResolution = "960x540",
            box64Mmap32 = true,
            box64BigBlock = 1,
            enableEsync = false,
            estimatedContainerCapMb = 900L
        )
        assertTrue(budget.isSubAndroid10)
        assertTrue(budget.box64Mmap32)
        assertEquals("960x540", budget.maxVirtualResolution)
    }
}
