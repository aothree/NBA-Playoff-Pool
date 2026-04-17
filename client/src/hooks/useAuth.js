import { useState, useCallback } from 'react';

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function getStoredUser() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  // Check expiry
  if (payload.exp && Date.now() / 1000 > payload.exp) {
    localStorage.removeItem('token');
    return null;
  }
  return payload;
}

export function useAuth() {
  const [user, setUser] = useState(() => getStoredUser());
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  const login = useCallback((newToken) => {
    localStorage.setItem('token', newToken);
    const payload = decodeJwtPayload(newToken);
    setToken(newToken);
    setUser(payload);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  return {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!user,
    isAdmin: !!(user && user.is_admin),
  };
}
