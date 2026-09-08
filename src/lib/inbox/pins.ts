// Cuantas conversaciones se pueden tener fijadas arriba de la bandeja a la
// vez. Mas que esto y dejan de ser "las importantes" para volverse una
// segunda lista.
//
// Vive aparte de la accion de servidor porque un archivo "use server" solo
// puede exportar funciones async, y la interfaz tambien necesita el numero.
export const MAX_PINNED_CONVERSATIONS = 3;
