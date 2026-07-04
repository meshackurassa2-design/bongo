import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Profile } from '../constants';

type AuthStore = {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  // Actions
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, username: string, displayName: string, role: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  fetchProfile: (userId?: string) => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  profile: null,
  isLoading: true,

  init: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    set({ session, isLoading: false });
    if (session?.user) {
      get().fetchProfile(session.user.id);
    }
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
      if (session?.user) get().fetchProfile(session.user.id);
      else set({ profile: null });
    });
  },

  signIn: async (email, password) => {
    set({ isLoading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ isLoading: false });
    return error?.message ?? null;
  },

  signUp: async (email, password, username, displayName, role) => {
    set({ isLoading: true });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, display_name: displayName },
      },
    });
    if (error) { set({ isLoading: false }); return error.message; }
    // Update role after signup
    if (data.user) {
      await supabase.from('profiles').update({ role }).eq('id', data.user.id);
    }
    set({ isLoading: false });
    return null;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },

  fetchProfile: async (userId) => {
    const id = userId || get().session?.user.id;
    if (!id) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    if (data) set({ profile: data as Profile });
  },
}));
