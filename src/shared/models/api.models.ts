// Based on Supabase Auth user
export interface User {
  id: string;
  email?: string;
  user_metadata: {
    full_name?: string;
    avatar_url?: string;
    must_change_password?: boolean;
  };
  // Add other fields as needed
}

export interface Bem {
  id: number;
  codigo: string;
  descricao: string;
  categoria?: string | null;
  localizacao?: string | null;
  responsavel?: string | null;
  data_aquisicao?: string | null; // date as string
  valor?: number | null;
  numero_patrimonio: string;
  situacao: 'ativo' | 'inativo' | 'em_manutencao' | 'baixado';
  foto_urls?: string[] | null;
  usuario_id: string; // uuid Campo do banco de dados (que o RLS preenche)
  numero_serie?: string | null;
  fabricante?: string | null;
  modelo?: string | null;
  observacoes?: string | null;
  created_at: string;
  updated_at?: string | null;
  estado_conservacao_dep?: number | null;
  favorito?: boolean;
}

export interface InventarioItem {
  id: number;
  bem_id: number | null;
  plaqueta_lida: string;
  data_coleta: string;
  usuario_coleta_id: string;
  latitude?: number;
  longitude?: number;
  status_conciliacao: 'conciliado' | 'divergente' | 'nao_encontrado';
  observacao?: string;
  is_synced: boolean;
}

// Other models can be added here
export interface Localizacao {
  id: number;
  nome: string;
  descricao?: string;
}

export interface Permissao {
    id: number;
    descricao: 'ROLE_ADMIN' | 'ROLE_USER';
}

export interface PessoaFisica {
    user_id: string;
    nome_completo: string;
    cpf: string;
    data_nascimento: string;
    telefone_celular: string;
    sexo: string;
    cep: string;
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    email: string;
}

export interface PessoaJuridica {
    user_id: string;
    razao_social: string;
    cnpj: string;
    nome_fantasia: string;
    telefone_comercial: string;
    responsavel_legal: string;
    inscricao_estadual: string;
    inscricao_municipal: string;
    cep: string;
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    email: string;
}

export interface UserProfile {
  user_id: string;
  nome: string;
  email: string;
  tipo: 'Pessoa Física' | 'Pessoa Jurídica';
  documento: string; // CPF or CNPJ
  permissoes: string | null; // e.g., "admin, leitura"
}