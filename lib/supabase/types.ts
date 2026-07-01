// Hand-written types matching 001_schema.sql.
// Replace with: pnpm supabase gen types typescript --project-id <id> > lib/supabase/types.ts

export interface UserRow {
  id: string;
  firebase_uid: string;
  name: string;
  phone: string;
  avatar_url: string | null;
  created_at: string;
}
export interface UserInsert {
  firebase_uid: string;
  name: string;
  phone: string;
  avatar_url?: string | null;
}

export interface GroupRow {
  id: string;
  name: string;
  invite_code: string;
  sport: string;
  created_by: string | null;
  created_at: string;
}
export interface GroupInsert {
  name: string;
  sport?: string;
  created_by?: string | null;
}

export interface GroupMemberRow {
  group_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}
export interface GroupMemberInsert {
  group_id: string;
  user_id: string;
  role?: string;
}

export interface TurfRow {
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
export interface TurfInsert {
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  default_capacity?: number | null;
  added_by?: string | null;
}

export interface SessionRow {
  id: string;
  group_id: string;
  organizer_id: string | null;
  payment_collector_id: string | null;
  turf_id: string | null;
  scheduled_at: string;
  max_capacity: number;
  team_selection_mode: string;
  status: string;
  created_at: string;
}
export interface SessionInsert {
  group_id: string;
  organizer_id?: string | null;
  payment_collector_id?: string | null;
  turf_id?: string | null;
  scheduled_at: string;
  max_capacity?: number;
  team_selection_mode?: string;
  status?: string;
}

export interface SessionVoteRow {
  id: string;
  session_id: string;
  user_id: string;
  voted_in: boolean;
  guest_count: number;
  guest_names: string[];
  opted_captain: boolean;
  created_at: string;
}
export interface SessionVoteInsert {
  session_id: string;
  user_id: string;
  voted_in?: boolean;
  guest_count?: number;
  guest_names?: string[];
  opted_captain?: boolean;
}

export interface SessionWaitlistRow {
  id: string;
  session_id: string;
  user_id: string;
  position: number;
  joined_at: string;
}

export interface AttendanceRow {
  id: string;
  session_id: string;
  user_id: string;
  attended: boolean;
  marked_by: string | null;
  marked_at: string;
}
export interface AttendanceInsert {
  session_id: string;
  user_id: string;
  attended?: boolean;
  marked_by?: string | null;
}

export interface PaymentRow {
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
export interface PaymentInsert {
  session_id: string;
  payer_id?: string | null;
  accountable_member_id?: string | null;
  collector_id?: string | null;
  amount?: number | null;
  status?: string;
}

export interface SessionCaptainRow {
  id: string;
  session_id: string;
  user_id: string;
  team: string;
}
export interface SessionCaptainInsert {
  session_id: string;
  user_id: string;
  team: string;
}

export interface MatchRatingRow {
  id: string;
  session_id: string;
  rated_user_id: string;
  rater_user_id: string;
  rating_value: number | null;
  tags: string[];
  created_at: string;
}
export interface MatchRatingInsert {
  session_id: string;
  rated_user_id: string;
  rater_user_id: string;
  rating_value?: number | null;
  tags?: string[];
}

export type Database = {
  public: {
    Tables: {
      users: { Row: UserRow; Insert: UserInsert; Update: Partial<UserInsert> };
      groups: { Row: GroupRow; Insert: GroupInsert; Update: Partial<GroupInsert> };
      group_members: { Row: GroupMemberRow; Insert: GroupMemberInsert; Update: Partial<GroupMemberInsert> };
      turfs: { Row: TurfRow; Insert: TurfInsert; Update: Partial<TurfInsert> };
      sessions: { Row: SessionRow; Insert: SessionInsert; Update: Partial<SessionInsert> };
      session_votes: { Row: SessionVoteRow; Insert: SessionVoteInsert; Update: Partial<SessionVoteInsert> };
      session_waitlist: { Row: SessionWaitlistRow; Insert: { session_id: string; user_id: string; position: number }; Update: { position?: number } };
      attendance: { Row: AttendanceRow; Insert: AttendanceInsert; Update: Partial<AttendanceInsert> };
      payments: { Row: PaymentRow; Insert: PaymentInsert; Update: Partial<PaymentInsert> };
      session_captains: { Row: SessionCaptainRow; Insert: SessionCaptainInsert; Update: never };
      match_ratings: { Row: MatchRatingRow; Insert: MatchRatingInsert; Update: never };
    };
  };
};
