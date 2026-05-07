import 'vuetify/styles'

import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { aliases, mdi } from 'vuetify/iconsets/mdi'

const vuetify = createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    },
  },
  theme: {
    defaultTheme: 'ushioTheme',
    themes: {
      ushioTheme: {
        dark: false,
        colors: {
          background: '#f7f2ed',
          surface: '#ffffff',
          primary: '#492D22',
          secondary: '#D8C7B5',
          info: '#8A6B59',
        },
      },
    },
  },
})

export default vuetify
