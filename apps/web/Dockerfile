###############################################
#           Node.js build stage (alpine)      #
###############################################
ARG NODE_VERSION=20
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS node-build

# comment for testing

WORKDIR /source
COPY package*.json ./
COPY . .
RUN npm ci

WORKDIR /source/apps/web
ARG NPM_COMMAND=dist:bit:selfhost
RUN npm run ${NPM_COMMAND}

###############################################
#                Build stage 2                #
###############################################
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:8.0-alpine3.21 AS build

# Docker buildx supplies the value for this arg
ARG TARGETPLATFORM

# Determine proper runtime value for .NET
# We put the value in a file to be read by later layers.
RUN if [ "$TARGETPLATFORM" = "linux/amd64" ]; then \
      RID=linux-musl-x64 ; \
    elif [ "$TARGETPLATFORM" = "linux/arm64" ]; then \
      RID=linux-musl-arm64 ; \
    elif [ "$TARGETPLATFORM" = "linux/arm/v7" ]; then \
      RID=linux-musl-arm ; \
    fi \
    && echo "RID=$RID" > /tmp/rid.txt

# Copy csproj files as distinct layers
WORKDIR /source
COPY server/util/Server/*.csproj ./util/Server/
COPY server/Directory.Build.props .
COPY server/.editorconfig .

# Restore Server project dependencies and tools
WORKDIR /source/util/Server
RUN . /tmp/rid.txt && dotnet restore -r $RID

# Copy required project files
WORKDIR /source
COPY server/util/Server/. ./util/Server/
COPY server/.git/. ./.git/

# Build Server app
WORKDIR /source/util/Server
RUN . /tmp/rid.txt && dotnet publish -c release -o /app/Server --no-restore --no-self-contained -r $RID

WORKDIR /app

###############################################
#                  App stage                  #
###############################################
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine3.21

ARG TARGETPLATFORM
LABEL com.bitwarden.product="bitwarden"
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:5000
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false
EXPOSE 5000

RUN apk add --no-cache curl \
    icu-libs \
    shadow \
    && apk add --no-cache --repository=http://dl-cdn.alpinelinux.org/alpine/edge/community gosu

# Copy app from the build stage
WORKDIR /bitwarden_server
COPY --from=build /app/Server ./

WORKDIR /app
COPY --from=node-build /source/apps/web/build .
COPY --from=node-build /source/apps/web/entrypoint.sh /
RUN chmod +x /entrypoint.sh

HEALTHCHECK CMD curl -f http://localhost:5000 || exit 1

ENTRYPOINT ["/entrypoint.sh"]
