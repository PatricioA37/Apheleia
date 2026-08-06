/**
 * Superficie pública de datos. Lo ÚNICO que importan las pantallas.
 *
 * Ninguna pantalla sabe ni debe saber si detrás hay mock o HTTP. Esa es la
 * propiedad que permite conectar el backend sin tocar una sola pantalla.
 */
import { clienteHttp } from '@/lib/cliente-http';
import { clienteMock } from '@/lib/cliente-mock';
import { MODO } from '@/lib/config';
import type { ClienteApi } from '@/lib/contratos';

const cliente: ClienteApi = MODO === 'http' ? clienteHttp : clienteMock;

export const obtenerPerfil: ClienteApi['obtenerPerfil'] = (id) => cliente.obtenerPerfil(id);
export const obtenerMedicamentos: ClienteApi['obtenerMedicamentos'] = (id) =>
  cliente.obtenerMedicamentos(id);
export const obtenerControles: ClienteApi['obtenerControles'] = (id) =>
  cliente.obtenerControles(id);
export const obtenerPlan: ClienteApi['obtenerPlan'] = (id) => cliente.obtenerPlan(id);
export const obtenerAvisos: ClienteApi['obtenerAvisos'] = (id) => cliente.obtenerAvisos(id);
export const enviarMensaje: ClienteApi['enviarMensaje'] = (id, texto) =>
  cliente.enviarMensaje(id, texto);
