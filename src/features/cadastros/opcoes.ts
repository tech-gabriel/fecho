import {
  Baby,
  BookOpen,
  Car,
  Dumbbell,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  PartyPopper,
  PawPrint,
  Plane,
  Repeat,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Tag,
  Utensils,
  type LucideIcon,
} from 'lucide-react';

export const CORES_DE_CARTAO = [
  { nome: 'Roxo', hex: '#8B5CF6' },
  { nome: 'Índigo', hex: '#6366F1' },
  { nome: 'Azul', hex: '#3B82F6' },
  { nome: 'Ciano', hex: '#06B6D4' },
  { nome: 'Verde-água', hex: '#14B8A6' },
  { nome: 'Rosa', hex: '#EC4899' },
  { nome: 'Grafite', hex: '#57534E' },
  { nome: 'Oliva', hex: '#65A30D' },
] as const;

export const COR_DE_PESSOA = '#2563EB';

export const ICONES_DE_CATEGORIA: Record<string, { rotulo: string; icone: LucideIcon }> = {
  'shopping-cart': { rotulo: 'Carrinho', icone: ShoppingCart },
  utensils: { rotulo: 'Talheres', icone: Utensils },
  car: { rotulo: 'Carro', icone: Car },
  fuel: { rotulo: 'Combustível', icone: Fuel },
  house: { rotulo: 'Casa', icone: House },
  'heart-pulse': { rotulo: 'Saúde', icone: HeartPulse },
  'party-popper': { rotulo: 'Festa', icone: PartyPopper },
  'shopping-bag': { rotulo: 'Sacola', icone: ShoppingBag },
  repeat: { rotulo: 'Repetição', icone: Repeat },
  'graduation-cap': { rotulo: 'Formatura', icone: GraduationCap },
  'book-open': { rotulo: 'Livro', icone: BookOpen },
  plane: { rotulo: 'Avião', icone: Plane },
  shirt: { rotulo: 'Roupa', icone: Shirt },
  gift: { rotulo: 'Presente', icone: Gift },
  dumbbell: { rotulo: 'Academia', icone: Dumbbell },
  smartphone: { rotulo: 'Celular', icone: Smartphone },
  'paw-print': { rotulo: 'Pet', icone: PawPrint },
  baby: { rotulo: 'Bebê', icone: Baby },
  tag: { rotulo: 'Etiqueta', icone: Tag },
};

export function iconeDaCategoria(nome: string): LucideIcon {
  return ICONES_DE_CATEGORIA[nome]?.icone ?? Tag;
}
