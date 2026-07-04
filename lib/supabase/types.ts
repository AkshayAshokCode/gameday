// Hand-written types matching 001_schema.sql.
// Replace with: pnpm supabase gen types typescript --project-id <id> > lib/supabase/types.ts

export type UserRow = {
  id: string;
  firebase_uid: string;
  name: string;
  phone: string;
  avatar_url: string | null;
  upi_id: string | null;
  created_at: string;
}
export type UserInsert = {
  firebase_uid: string;
  name: string;
  phone: string;
  avatar_url?: string | null;
  upi_id?: string | null;
}

export type GroupRow = {
  id: string;
  name: string;
  invite_code: string;
  sport: string;
  created_by: string | null;
  created_at: string;
}
export type GroupInsert = {
  name: string;
  sport?: string;
  created_by?: string | null;
}

export type GroupMemberRow = {
  group_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}
export type GroupMemberInsert = {
  group_id: string;
  user_id: string;
  role?: string;
}

export type GroupTurfRow = {
  group_id: string;
  turf_id: string;
  added_by: string | null;
  created_at: string;
}
export type GroupTurfInsert = {
  group_id: string;
  turf_id: string;
  added_by?: string | null;
}

export type TurfRow = {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  default_capacity: number | null;
  photos: string[];
  added_by: string | null;
  created_at: string;
}
export type TurfInsert = {
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  default_capacity?: number | null;
  added_by?: string | null;
}

export type SessionRow = {
  id: string;
  group_id: string;
  organizer_id: string | null;
  payment_collector_id: string | null;
  turf_id: string | null;
  scheduled_at: string | null;
  ends_at: string | null;
  max_capacity: number;
  team_selection_mode: string;
  status: string;
  cost_per_head: number | null;
  sport: string | null;
  created_at: string;
}
export type SessionInsert = {
  group_id: string;
  organizer_id?: string | null;
  payment_collector_id?: string | null;
  turf_id?: string | null;
  scheduled_at?: string | null;
  ends_at?: string | null;
  max_capacity?: number;
  team_selection_mode?: string;
  status?: string;
  cost_per_head?: number | null;
  sport?: string | null;
}

export type SessionDayOptionRow = {
  id: string;
  session_id: string;
  scheduled_at: string;
  ends_at: string | null;
  created_at: string;
}
export type SessionDayOptionInsert = {
  session_id: string;
  scheduled_at: string;
  ends_at?: string | null;
}

export type SessionDayVoteRow = {
  day_option_id: string;
  user_id: string;
  created_at: string;
}
export type SessionDayVoteInsert = {
  day_option_id: string;
  user_id: string;
}

export type SessionVoteRow = {
  id: string;
  session_id: string;
  user_id: string;
  voted_in: boolean;
  guest_count: number;
  guest_names: string[];
  opted_captain: boolean;
  created_at: string;
}
export type SessionVoteInsert = {
  session_id: string;
  user_id: string;
  voted_in?: boolean;
  guest_count?: number;
  guest_names?: string[];
  opted_captain?: boolean;
}

export type SessionWaitlistRow = {
  id: string;
  session_id: string;
  user_id: string;
  position: number;
  joined_at: string;
}

export type AttendanceRow = {
  id: string;
  session_id: string;
  user_id: string;
  attended: boolean;
  marked_by: string | null;
  marked_at: string;
}
export type AttendanceInsert = {
  session_id: string;
  user_id: string;
  attended?: boolean;
  marked_by?: string | null;
}

export type PaymentRow = {
  id: string;
  session_id: string;
  payer_id: string | null;
  accountable_member_id: string | null;
  collector_id: string | null;
  amount: number | null;
  status: string;
  marked_at: string | null;
  created_at: string;
}
export type PaymentInsert = {
  session_id: string;
  payer_id?: string | null;
  accountable_member_id?: string | null;
  collector_id?: string | null;
  amount?: number | null;
  status?: string;
  marked_at?: string | null;
}

export type SessionCaptainRow = {
  id: string;
  session_id: string;
  user_id: string;
  team: string;
}
export type SessionCaptainInsert = {
  session_id: string;
  user_id: string;
  team: string;
}

export type MatchRatingRow = {
  id: string;
  session_id: string;
  rated_user_id: string;
  rater_user_id: string;
  rating_value: number | null;
  tags: string[];
  created_at: string;
}
export type MatchRatingInsert = {
  session_id: string;
  rated_user_id: string;
  rater_user_id: string;
  rating_value?: number | null;
  tags?: string[];
}

// postgrest-js's GenericTable requires a `Relationships` array on every table
// entry (used for embedded-resource type inference); without it the whole
// generic silently collapses to `never`. We don't hand-model actual FK
// relationships here, so this is just `[]` — embedded selects (e.g.
// `turfs(name)`) still work at runtime, just without join-result typing.
type NoRelationships = { Relationships: [] };

export type Database = {
  public: {
    Tables: {
      users: { Row: UserRow; Insert: UserInsert; Update: Partial<UserInsert> } & NoRelationships;
      groups: { Row: GroupRow; Insert: GroupInsert; Update: Partial<GroupInsert> } & NoRelationships;
      group_members: { Row: GroupMemberRow; Insert: GroupMemberInsert; Update: Partial<GroupMemberInsert> } & NoRelationships;
      turfs: { Row: TurfRow; Insert: TurfInsert; Update: Partial<TurfInsert> } & NoRelationships;
      group_turfs: { Row: GroupTurfRow; Insert: GroupTurfInsert; Update: never } & NoRelationships;
      sessions: { Row: SessionRow; Insert: SessionInsert; Update: Partial<SessionInsert> } & NoRelationships;
      session_day_options: { Row: SessionDayOptionRow; Insert: SessionDayOptionInsert; Update: never } & NoRelationships;
      session_day_votes: { Row: SessionDayVoteRow; Insert: SessionDayVoteInsert; Update: never } & NoRelationships;
      session_votes: { Row: SessionVoteRow; Insert: SessionVoteInsert; Update: Partial<SessionVoteInsert> } & NoRelationships;
      session_waitlist: { Row: SessionWaitlistRow; Insert: { session_id: string; user_id: string; position: number }; Update: { position?: number } } & NoRelationships;
      attendance: { Row: AttendanceRow; Insert: AttendanceInsert; Update: Partial<AttendanceInsert> } & NoRelationships;
      payments: { Row: PaymentRow; Insert: PaymentInsert; Update: Partial<PaymentInsert> } & NoRelationships;
      session_captains: { Row: SessionCaptainRow; Insert: SessionCaptainInsert; Update: never } & NoRelationships;
      match_ratings: { Row: MatchRatingRow; Insert: MatchRatingInsert; Update: never } & NoRelationships;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
