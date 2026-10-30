FROM node:22-alpine AS web
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci --no-audit --no-fund
COPY frontend/ ./frontend/
COPY server/rules.json ./server/rules.json
RUN cd frontend && npm run build

FROM golang:1.27.3-alpine AS server
WORKDIR /app
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /ironfront .

FROM scratch
COPY --from=server /ironfront /ironfront
COPY --from=web /app/frontend/dist /web
ENV PORT=8787 STATIC_DIR=/web
USER 10001:10001
EXPOSE 8787
ENTRYPOINT ["/ironfront"]
