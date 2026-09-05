import { createContext, useContext, useState, useCallback } from "react";
import { authApi } from "../api/resources.js";
import { setAccessToken } from "../api/client.js";
import { signInWithGoogle, firebaseSignOut, sendOtp } from "../lib/firebase.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("callos_user")); } catch { return null; }
  });

  const _saveSession = useCallback(async (tokenData) => {
    setAccessToken(tokenData.access_token);
    localStorage.setItem("callos_token", tokenData.access_token);
    const me = await authApi.me();
    localStorage.setItem("callos_user", JSON.stringify(me));
    setUser(me);
    return me;
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authApi.login({ email, password });
    return _saveSession(data);
  }, [_saveSession]);

  const register = useCallback(async (payload) => {
    const data = await authApi.register(payload);
    return _saveSession(data);
  }, [_saveSession]);

  const loginWithGoogle = useCallback(async () => {
    const idToken = await signInWithGoogle();
    const data = await authApi.google(idToken);
    return _saveSession(data);
  }, [_saveSession]);

  const loginWithOtp = useCallback(async (confirmationResult, otp) => {
    const result = await confirmationResult.confirm(otp);
    const idToken = await result.user.getIdToken();
    const data = await authApi.otp(idToken);  // dedicated OTP endpoint
    return _saveSession(data);
  }, [_saveSession]);

  const logout = useCallback(async () => {
    await firebaseSignOut().catch(() => {});
    setAccessToken(null);
    localStorage.removeItem("callos_token");
    localStorage.removeItem("callos_user");
    setUser(null);
  }, []);

  useState(() => {
    const token = localStorage.getItem("callos_token");
    if (token) setAccessToken(token);
  });

  return (
    <AuthContext.Provider value={{ user, setUser, login, register, loginWithGoogle, loginWithOtp, logout, isAuthed: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
