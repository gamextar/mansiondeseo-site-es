import { createContext, useContext } from 'react';

export const AuthContext = createContext({
  registered: false,
  user: null,
  siteSettings: {},
  bootstrapStories: [],
  bootstrapResolved: false,
  setRegistered: () => {},
  setUser: () => {},
  setSiteSettings: () => {},
  setBootstrapStories: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
