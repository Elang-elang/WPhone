-keep class id.wphone.WPhoneNativeBridge { *; }
-keepclassmembers class id.wphone.WPhoneNativeBridge {
    native <methods>;
}
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class * {
    @kotlinx.serialization.Serializable <fields>;
}
-keep,includedescriptorclasses class id.wphone.core.**$$serializer { *; }
-keepclassmembers class id.wphone.core.** {
    *** Companion;
}
-keepclasseswithmembers class id.wphone.core.** {
    kotlinx.serialization.KSerializer serializer(...);
}
