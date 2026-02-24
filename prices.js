// Precios base por servicio y longitud
export const BASE_PRICES = {
  gel: {
    corto: 180,    // 1-2 tonos
    medio: 190,    // 3-5 tonos
    largo: 190,    // 3-5 tonos
    xl: 190        // 3-5 tonos
  },
  rubber: {
    corto: 230,    // 1 tono base
    medio: 230,
    largo: 230,
    xl: 230
  },
  softgel: {
    corto: 300,    // Tip corto
    medio: 350,    // Tip mediano
    largo: 370,
    xl: 380
  },
  acrilico: {
    corto: 280,    // Largo 1
    medio: 310,    // Largo 2
    largo: 330,    // Largo 3
    xl: 350,       // Largo 4
  }
};

// Precios por diseño por uña
export const DESIGN_PRICES = {
  // French varía según longitud de uña
  french: {
    corto: 5,      // Uña corta #1
    medio: 7.50,   // Uña mediana #2 y #3
    largo: 10,     // Uña larga #4 en adelante
    xl: 10,
  },
  babyboomer: 10,
  hand_paint: 5,   // Mano alzada (desde $5)
  mirror_effect: 10, // Efecto espejo
  effects: 10,     // Efectos (glitter, cat eye, aurora, etc.)
  decoration: 10,  // Decoración (stickers, flores, 3D, relieves, charms)
  encapsulated: 10,
  rhinestones: 3   // Promedio de cristales ($1-$5, usamos $3 como promedio)
};

// Precios adicionales de servicios
export const ADDITIONAL_SERVICES = {
  gel_removal: 70,
  gel_manicure: 150,
  acrylic_removal: 120,
  acrylic_manicure: 180,
  acrylic_bath: 250,
  rubber_touchup: 200
};
  