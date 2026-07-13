package me.ayartuerk.crmadmin.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.adminDataStore by preferencesDataStore(name = "admin_auth")

class TokenStore(private val context: Context) {
    private val tokenKey = stringPreferencesKey("access_token")

    val token: Flow<String?> = context.adminDataStore.data.map { preferences ->
        preferences[tokenKey]
    }

    suspend fun saveToken(token: String) {
        context.adminDataStore.edit { preferences ->
            preferences[tokenKey] = token
        }
    }

    suspend fun clearToken() {
        context.adminDataStore.edit { preferences ->
            preferences.remove(tokenKey)
        }
    }
}
