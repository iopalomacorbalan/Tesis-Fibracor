import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Usuario } from "@/types/database";

interface AuthState {
  user: User | null;
  profile: Usuario | null;
  loading: boolean;
  initialized: boolean;
  profileLoading: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  loadProfile: (userId: string) => Promise<void>;
}

let listenerSubscribed = false;

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: false,
  initialized: false,
  profileLoading: false,

  init: async () => {
    // Evita inicializar múltiples veces (ej. si el componente se re-monta)
    if (get().initialized) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      set({ user });
      if (user) {
        await get().loadProfile(user.id);
      }
    } catch (e) {
      console.error("Auth init error:", e);
    } finally {
      set({ initialized: true });
    }

    // Solo suscribir el listener una vez en toda la app
    if (!listenerSubscribed) {
      listenerSubscribed = true;
      supabase.auth.onAuthStateChange(async (event, session) => {
        // Ignorar TOKEN_REFRESHED para evitar reload de profile innecesario
        if (event === "TOKEN_REFRESHED") {
          set({ user: session?.user ?? null });
          return;
        }
        const newUser = session?.user ?? null;
        const currentUserId = get().user?.id;
        set({ user: newUser });

        if (newUser && newUser.id !== currentUserId) {
          // Cambió el usuario — recargar profile
          await get().loadProfile(newUser.id);
        } else if (!newUser) {
          set({ profile: null });
        }
      });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        set({ loading: false });
        return { error };
      }
      // Cargar profile inmediatamente en lugar de esperar al listener
      if (data.user) {
        set({ user: data.user });
        await get().loadProfile(data.user.id);
      }
      set({ loading: false });
      return { error: null };
    } catch (e: any) {
      set({ loading: false });
      return { error: e };
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null });
  },

  loadProfile: async (userId: string) => {
    set({ profileLoading: true });
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .eq("id", userId)
        .single();
      if (!error && data) {
        set({ profile: data as Usuario });
      } else if (error) {
        console.error("Error cargando perfil:", error);
        // Si no hay perfil pero sí auth user, dejar profile null
        set({ profile: null });
      }
    } finally {
      set({ profileLoading: false });
    }
  },
}));
