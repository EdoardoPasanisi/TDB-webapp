# Regole R8 dell'app (le librerie Capacitor/plugin portano le proprie).
#
# Il guscio è una WebView Capacitor: quasi tutto il codice nativo sono i plugin, che
# Capacitor chiama per nome/reflection. Le regole ufficiali stanno in
# node_modules/@capacitor/android/capacitor/proguard-rules.pro (consumer rules).

# Nomi di file e righe leggibili nei crash di Play Console (con il mapping nell'AAB).
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Metodi esposti a JavaScript dalla WebView (bridge Capacitor, SystemBars).
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Annotazioni usate da Capacitor a runtime per trovare plugin e metodi.
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Plugin Cordova/Capacitor registrati per nome (capacitor.plugins.json).
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.plugins.** { *; }
-keep class app.tenutadelbarone.client.** { *; }

# Login Google: Credential Manager carica l'implementazione Play Services via reflection.
-if class androidx.credentials.CredentialManager
-keep class androidx.credentials.playservices.** { *; }
