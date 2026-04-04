import { createContext, useContext } from 'react';

export const AuthContext = createContext({
  registered: false,
  user: null,
  siteSettings: {},
  setRegistered: () => {},
  setUser: () => {},
  setSiteSettings: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
