// Mock conversations and messages for chat system

export const mockConversations = [
  {
    id: 'conv1',
    profileId: '1',
    name: 'Valentina & Marco',
    avatar: 'https://picsum.photos/seed/mansion1a/100/100',
    lastMessage: 'Nos encantaría conoceros este fin de semana 😊',
    timestamp: 'Hace 5 min',
    unread: 2,
    online: true,
  },
  {
    id: 'conv2',
    profileId: '2',
    name: 'Sofía',
    avatar: 'https://picsum.photos/seed/mansion2a/100/100',
    lastMessage: '¿Habéis ido alguna vez a un club en Barcelona?',
    timestamp: 'Hace 1h',
    unread: 0,
    online: true,
  },
  {
    id: 'conv3',
    profileId: '4',
    name: 'Carmen & Luis',
    avatar: 'https://picsum.photos/seed/mansion4a/100/100',
    lastMessage: 'Perfecto, entonces quedamos el viernes',
    timestamp: 'Hace 3h',
    unread: 1,
    online: false,
  },
  {
    id: 'conv4',
    profileId: '8',
    name: 'Natalia',
    avatar: 'https://picsum.photos/seed/mansion8a/100/100',
    lastMessage: 'Me ha encantado vuestro perfil',
    timestamp: 'Ayer',
    unread: 0,
    online: true,
  },
  {
    id: 'conv5',
    profileId: '10',
    name: 'Elena & Roberto',
    avatar: 'https://picsum.photos/seed/mansion10a/100/100',
    lastMessage: 'Organizamos un encuentro privado el mes que viene',
    timestamp: 'Hace 2d',
    unread: 0,
    online: false,
  },
];

export const mockMessages = {
  conv1: [
    {
      id: 'm1',
      senderId: 'them',
      text: '¡Hola! Hemos visto vuestro perfil y nos ha encantado 🔥',
      timestamp: '20:15',
    },
    {
      id: 'm2',
      senderId: 'me',
      text: '¡Muchas gracias! Nosotros también os hemos estado mirando. Tenéis muy buena energía',
      timestamp: '20:18',
    },
    {
      id: 'm3',
      senderId: 'them',
      text: '¿Lleváis mucho tiempo en el ambiente?',
      timestamp: '20:20',
    },
    {
      id: 'm4',
      senderId: 'me',
      text: 'Un par de años, pero vamos con calma. Nos gusta conocer a las personas primero',
      timestamp: '20:22',
    },
    {
      id: 'm5',
      senderId: 'them',
      text: 'Nosotros igual, la confianza es lo primero. ¿Os apetecería tomar algo este fin de semana para vernos?',
      timestamp: '20:25',
    },
    {
      id: 'm6',
      senderId: 'me',
      text: '¡Nos encantaría! ¿Qué zona os viene bien?',
      timestamp: '20:28',
    },
    {
      id: 'm7',
      senderId: 'them',
      text: 'Nos encantaría conoceros este fin de semana 😊',
      timestamp: '20:30',
    },
  ],
  conv2: [
    {
      id: 'm1',
      senderId: 'them',
      text: 'Hey! Vi que sois de Barcelona, ¿verdad?',
      timestamp: '18:00',
    },
    {
      id: 'm2',
      senderId: 'me',
      text: 'Sí, del centro! ¿Tú también?',
      timestamp: '18:05',
    },
    {
      id: 'm3',
      senderId: 'them',
      text: '¿Habéis ido alguna vez a un club en Barcelona?',
      timestamp: '18:10',
    },
  ],
  conv3: [
    {
      id: 'm1',
      senderId: 'me',
      text: 'Hola Carmen y Luis, encantados de conectar',
      timestamp: '14:00',
    },
    {
      id: 'm2',
      senderId: 'them',
      text: 'Igualmente! Nos encantan los perfiles como el vuestro',
      timestamp: '14:15',
    },
    {
      id: 'm3',
      senderId: 'me',
      text: '¿Estaríais disponibles algún viernes para quedar?',
      timestamp: '14:20',
    },
    {
      id: 'm4',
      senderId: 'them',
      text: 'Perfecto, entonces quedamos el viernes',
      timestamp: '14:30',
    },
  ],
  conv4: [
    {
      id: 'm1',
      senderId: 'them',
      text: 'Me ha encantado vuestro perfil',
      timestamp: '22:00',
    },
  ],
  conv5: [
    {
      id: 'm1',
      senderId: 'them',
      text: 'Hola! Somos Elena y Roberto. Organizamos encuentros selectos en Mallorca',
      timestamp: '10:00',
    },
    {
      id: 'm2',
      senderId: 'me',
      text: '¡Qué interesante! Nos encanta la isla. Contadnos más',
      timestamp: '10:30',
    },
    {
      id: 'm3',
      senderId: 'them',
      text: 'Organizamos un encuentro privado el mes que viene',
      timestamp: '11:00',
    },
  ],
};
