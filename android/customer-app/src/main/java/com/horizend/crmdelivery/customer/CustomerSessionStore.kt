package com.horizend.crmdelivery.customer

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import java.security.SecureRandom
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

internal class CustomerSessionStore(context: Context) {
    private val preferences = context.getSharedPreferences(
        PREFERENCES_NAME,
        Context.MODE_PRIVATE
    )

    fun installationId(): String {
        preferences.getString(INSTALLATION_ID_KEY, null)
            ?.takeIf { it.isNotBlank() }
            ?.let { return it }

        val value = "android_customer_${UUID.randomUUID()}"
        preferences.edit().putString(INSTALLATION_ID_KEY, value).apply()
        return value
    }

    fun readAccessToken(): String? {
        val encodedCiphertext = preferences.getString(TOKEN_KEY, null)
            ?: return null
        val encodedIv = preferences.getString(TOKEN_IV_KEY, null)
            ?: return null

        return runCatching {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(
                Cipher.DECRYPT_MODE,
                getOrCreateSecretKey(),
                GCMParameterSpec(
                    AUTHENTICATION_TAG_LENGTH_BITS,
                    Base64.decode(encodedIv, Base64.NO_WRAP)
                )
            )

            String(
                cipher.doFinal(
                    Base64.decode(encodedCiphertext, Base64.NO_WRAP)
                ),
                Charsets.UTF_8
            ).takeIf { it.isNotBlank() }
        }.getOrElse {
            clearAccessToken()
            null
        }
    }

    fun writeAccessToken(accessToken: String) {
        require(accessToken.isNotBlank())

        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateSecretKey())

        val ciphertext = cipher.doFinal(
            accessToken.toByteArray(Charsets.UTF_8)
        )

        preferences.edit()
            .putString(
                TOKEN_KEY,
                Base64.encodeToString(ciphertext, Base64.NO_WRAP)
            )
            .putString(
                TOKEN_IV_KEY,
                Base64.encodeToString(cipher.iv, Base64.NO_WRAP)
            )
            .apply()
    }

    fun clearAccessToken() {
        preferences.edit()
            .remove(TOKEN_KEY)
            .remove(TOKEN_IV_KEY)
            .apply()
    }

    fun newInitiationNonce(): String {
        val bytes = ByteArray(32)
        SecureRandom().nextBytes(bytes)
        return Base64.encodeToString(
            bytes,
            Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP
        )
    }

    private fun getOrCreateSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEY_STORE).apply {
            load(null)
        }

        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let {
            return it
        }

        val generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            ANDROID_KEY_STORE
        )

        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or
                    KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(
                    KeyProperties.ENCRYPTION_PADDING_NONE
                )
                .build()
        )

        return generator.generateKey()
    }

    private companion object {
        const val PREFERENCES_NAME = "customer_session"
        const val INSTALLATION_ID_KEY = "installation_id"
        const val TOKEN_KEY = "access_token_ciphertext"
        const val TOKEN_IV_KEY = "access_token_iv"
        const val KEY_ALIAS = "crm_customer_session_key"
        const val ANDROID_KEY_STORE = "AndroidKeyStore"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val AUTHENTICATION_TAG_LENGTH_BITS = 128
    }
}
