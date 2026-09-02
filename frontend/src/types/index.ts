export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Document {
  id: string;
  title: string;
  content: string | null;
  version: number;
  owner_id: string;
  is_archived: boolean;
  last_edited_at: string;
  created_at: string;
  updated_at: string | null;
}

export interface DocumentWithPermissions extends Document {
  permissions: Permission[];
  is_owner: boolean;
  user_role?: string;
}

export interface Permission {
  id: string;
  document_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer' | 'commenter';
  created_at: string;
}

export interface Media {
  id: string;
  document_id: string;
  uploaded_by: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_url: string;
  thumbnail_url: string | null;
  public_id: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  content: string;
  timestamp: string;
}

export interface WebSocketMessage {
  type: string;
  document_id?: string;
  user_id?: string;
  data?: any;
  timestamp?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  username: string;
  password: string;
  full_name?: string;
}