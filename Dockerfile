# Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Variáveis do Vite precisam existir em tempo de build (são embutidas no bundle)
# (nunca passe service_role nem senha do banco aqui)
ARG VITE_NEO_SUPABASE_URL
ARG VITE_NEO_SUPABASE_ANON_KEY
ARG VITE_TRACEONE_SUPABASE_URL
ARG VITE_TRACEONE_SUPABASE_ANON_KEY
ARG VITE_TRACEONE_URL
ENV VITE_NEO_SUPABASE_URL=$VITE_NEO_SUPABASE_URL
ENV VITE_NEO_SUPABASE_ANON_KEY=$VITE_NEO_SUPABASE_ANON_KEY
ENV VITE_TRACEONE_SUPABASE_URL=$VITE_TRACEONE_SUPABASE_URL
ENV VITE_TRACEONE_SUPABASE_ANON_KEY=$VITE_TRACEONE_SUPABASE_ANON_KEY
ENV VITE_TRACEONE_URL=$VITE_TRACEONE_URL

RUN npm run build

# Runtime
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
