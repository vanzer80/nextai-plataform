import { supabase } from '@/src/lib/supabase';
import type { Client, ClientLocation, ClientWithLocations, CreateClientDTO, UpdateClientDTO } from '@/src/types/client';

export async function getClients(): Promise<ClientWithLocations[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*, client_locations(*)')
    .order('name');
  if (error) throw error;
  return (data ?? []) as ClientWithLocations[];
}

export async function createClient(dto: CreateClientDTO): Promise<Client> {
  const { locations, ...clientData } = dto;

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .insert(clientData)
    .select()
    .single();
  if (clientError) throw clientError;

  if (locations?.length) {
    const { error: locError } = await supabase
      .from('client_locations')
      .insert(locations.map(loc => ({ ...loc, client_id: client.id })));
    if (locError) {
      await supabase.from('clients').delete().eq('id', client.id);
      throw locError;
    }
  }

  return client as Client;
}

export async function updateClient(id: string, dto: UpdateClientDTO): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .update(dto)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Client;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw error;
}

export async function addLocation(
  clientId: string,
  location: Omit<ClientLocation, 'id' | 'client_id' | 'created_at'>,
): Promise<ClientLocation> {
  const { data, error } = await supabase
    .from('client_locations')
    .insert({ ...location, client_id: clientId })
    .select()
    .single();
  if (error) throw error;
  return data as ClientLocation;
}

export async function deleteLocation(locationId: string): Promise<void> {
  const { error } = await supabase.from('client_locations').delete().eq('id', locationId);
  if (error) throw error;
}
