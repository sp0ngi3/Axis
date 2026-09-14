FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["src/backend/Axis.Domain/Axis.Domain.csproj", "src/backend/Axis.Domain/"]
COPY ["src/backend/Axis.Application/Axis.Application.csproj", "src/backend/Axis.Application/"]
COPY ["src/backend/Axis.Infrastructure/Axis.Infrastructure.csproj", "src/backend/Axis.Infrastructure/"]
COPY ["src/backend/Axis.Api/Axis.Api.csproj", "src/backend/Axis.Api/"]
RUN dotnet restore "src/backend/Axis.Api/Axis.Api.csproj"
COPY . .
WORKDIR "/src/src/backend/Axis.Api"
RUN dotnet publish "Axis.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Axis.Api.dll"]
