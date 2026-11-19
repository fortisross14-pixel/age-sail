/** Crown colours: strong enough to stand out from the sepia map, distinct from each other. */
export const CROWN = {
  spain: { name: 'Castile', primary: 0xd9a521, secondary: 0xa3231a, css: '#d9a521', css2: '#a3231a' },
  portugal: { name: 'Portugal', primary: 0x2f7d46, secondary: 0xc8a63a, css: '#2f7d46', css2: '#c8a63a' },
  france: { name: 'France', primary: 0x2c4f9e, secondary: 0xe8d9a8, css: '#2c4f9e', css2: '#e8d9a8' },
  england: { name: 'England', primary: 0xb3202c, secondary: 0xf2efe6, css: '#b3202c', css2: '#f2efe6' },
  netherlands: { name: 'Netherlands', primary: 0xe0751f, secondary: 0x1f3f7a, css: '#e0751f', css2: '#1f3f7a' },
  venice: { name: 'Venice', primary: 0x6b2d6b, secondary: 0xd9b44a, css: '#6b2d6b', css2: '#d9b44a' },
} as const;

export const NATIVE = { plate: 0x7c5a35, css: '#7c5a35' };
