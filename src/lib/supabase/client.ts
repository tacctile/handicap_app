/**
 * Supabase Client Configuration
 *
 * Provides a singleton Supabase client for the application.
 * Uses environment variables for configuration.
 *
 * SETUP REQUIRED:
 * 1. Create a Supabase project at https://supabase.com
 * 2. Add your project URL and anon key to .env.local:
 *    VITE_SUPABASE_URL=your_project_url
 *    VITE_SUPABASE_ANON_KEY=your_anon_key
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

// Create client only if configured
let supabaseClient: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }

  return supabaseClient;
};

// Export a convenience reference (may be null if not configured)
export const supabase = getSupabaseClient();

// Export types for database schema
export interface Database {
  public: {
    Tables: {
      live_sessions: {
        Row: {
          id: string;
          share_code: string;
          created_at: string;
          updated_at: string;
          expires_at: string;
          owner_id: string | null;
          track_name: string;
          track_code: string;
          race_date: string;
          total_bankroll: number | null;
          experience_level: string | null;
          risk_style: string | null;
          is_active: boolean;
          viewer_count: number;
        };
        Insert: {
          id?: string;
          share_code: string;
          created_at?: string;
          updated_at?: string;
          expires_at?: string;
          owner_id?: string | null;
          track_name: string;
          track_code: string;
          race_date: string;
          total_bankroll?: number | null;
          experience_level?: string | null;
          risk_style?: string | null;
          is_active?: boolean;
          viewer_count?: number;
        };
        Update: {
          id?: string;
          share_code?: string;
          updated_at?: string;
          expires_at?: string;
          owner_id?: string | null;
          track_name?: string;
          track_code?: string;
          race_date?: string;
          total_bankroll?: number | null;
          experience_level?: string | null;
          risk_style?: string | null;
          is_active?: boolean;
          viewer_count?: number;
        };
      };
      live_session_races: {
        Row: {
          id: string;
          session_id: string;
          race_number: number;
          verdict: string | null;
          confidence: string | null;
          value_play_post: number | null;
          value_play_name: string | null;
          value_play_odds: string | null;
          value_play_edge: number | null;
          bet_suggestions: Record<string, unknown> | null;
          track_condition: string | null;
          allocated_budget: number | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          race_number: number;
          verdict?: string | null;
          confidence?: string | null;
          value_play_post?: number | null;
          value_play_name?: string | null;
          value_play_odds?: string | null;
          value_play_edge?: number | null;
          bet_suggestions?: Record<string, unknown> | null;
          track_condition?: string | null;
          allocated_budget?: number | null;
          updated_at?: string;
        };
        Update: {
          session_id?: string;
          race_number?: number;
          verdict?: string | null;
          confidence?: string | null;
          value_play_post?: number | null;
          value_play_name?: string | null;
          value_play_odds?: string | null;
          value_play_edge?: number | null;
          bet_suggestions?: Record<string, unknown> | null;
          track_condition?: string | null;
          allocated_budget?: number | null;
          updated_at?: string;
        };
      };
      live_session_horses: {
        Row: {
          id: string;
          session_id: string;
          race_number: number;
          post_position: number;
          horse_name: string;
          morning_line: string | null;
          live_odds: string | null;
          fair_odds: string | null;
          edge: number | null;
          is_scratched: boolean;
          model_rank: number | null;
          value_status: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          race_number: number;
          post_position: number;
          horse_name: string;
          morning_line?: string | null;
          live_odds?: string | null;
          fair_odds?: string | null;
          edge?: number | null;
          is_scratched?: boolean;
          model_rank?: number | null;
          value_status?: string | null;
          updated_at?: string;
        };
        Update: {
          session_id?: string;
          race_number?: number;
          post_position?: number;
          horse_name?: string;
          morning_line?: string | null;
          live_odds?: string | null;
          fair_odds?: string | null;
          edge?: number | null;
          is_scratched?: boolean;
          model_rank?: number | null;
          value_status?: string | null;
          updated_at?: string;
        };
      };
      live_session_multi_race: {
        Row: {
          id: string;
          session_id: string;
          bet_type: string;
          starting_race: number;
          ending_race: number;
          legs: Record<string, unknown>;
          combinations: number | null;
          total_cost: number | null;
          potential_return_min: number | null;
          potential_return_max: number | null;
          quality: string | null;
          what_to_say: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          bet_type: string;
          starting_race: number;
          ending_race: number;
          legs: Record<string, unknown>;
          combinations?: number | null;
          total_cost?: number | null;
          potential_return_min?: number | null;
          potential_return_max?: number | null;
          quality?: string | null;
          what_to_say?: string | null;
          updated_at?: string;
        };
        Update: {
          session_id?: string;
          bet_type?: string;
          starting_race?: number;
          ending_race?: number;
          legs?: Record<string, unknown>;
          combinations?: number | null;
          total_cost?: number | null;
          potential_return_min?: number | null;
          potential_return_max?: number | null;
          quality?: string | null;
          what_to_say?: string | null;
          updated_at?: string;
        };
      };
    };
  };
}
