export interface Client {
  id: string;
  created_at: string;
  name: string;
  cnpj?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
  cidade?: string | null;
  estado?: string | null;
  contato_nome?: string | null;
  contato_telefone?: string | null;
  contato_email?: string | null;
  observacoes?: string | null;
}

export interface ClientLocation {
  id: string;
  client_id: string;
  nome: string;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
  cidade?: string | null;
  estado?: string | null;
  contato_nome?: string | null;
  contato_telefone?: string | null;
  is_principal: boolean;
  created_at: string;
}

export interface ClientWithLocations extends Client {
  client_locations: ClientLocation[];
}

export type CreateClientDTO = Omit<Client, 'id' | 'created_at'> & {
  locations?: Omit<ClientLocation, 'id' | 'client_id' | 'created_at'>[];
};

export type UpdateClientDTO = Partial<Omit<Client, 'id' | 'created_at'>>;
