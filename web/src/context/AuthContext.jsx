import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { authApi } from "../api/resources.js";
import { setAccessToken } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      if (!localStorage.getItem("callos_token")) return null;
      return JSON.parse(localStorage.getItem("callos_user"));
    } catch { return null; }
  });

  const _saveSession = useCallback(async (tokenData) => {
    setAccessToken(tokenData.access_token);
    localStorage.setItem("callos_token", tokenData.access_token);
    if (tokenData.refresh_token) localStorage.setItem("callos_refresh_token", tokenData.refresh_token);
    try {
      const me = await authApi.me();
      localStorage.setItem("callos_user", JSON.stringify(me));
      setUser(me);
      return me;
    } catch (error) {
      setAccessToken(null);
      localStorage.removeItem("callos_token");
      localStorage.removeItem("callos_refresh_token");
      localStorage.removeItem("callos_user");
      throw error;
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authApi.login({ email, password });
    return _saveSession(data);
  }, [_saveSession]);

  const register = useCallback(async (payload) => {
    const data = await authApi.register(payload);
    return _saveSession(data);
  }, [_saveSession]);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    setAccessToken(null);
    localStorage.removeItem("callos_token");
    localStorage.removeItem("callos_refresh_token");
    localStorage.removeItem("callos_user");
    localStorage.removeItem("callos_orgs");
    setUser(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("callos_token");
    setAccessToken(token || null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, login, register, logout, isAuthed: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
