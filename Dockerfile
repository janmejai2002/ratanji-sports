FROM node:22-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Build client React application into dist/
RUN npm run build

# Expose production port
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Launch the unified Express + SQLite + WebSocket server
CMD ["npm", "start"]
