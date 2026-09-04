# Usa uma imagem leve do Node.js
FROM node:20-alpine

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de dependência primeiro para aproveitar o cache do Docker
COPY package*.json ./

# Instala as dependências do projeto
RUN npm install

# Copia todo o restante do código fonte para o container
COPY . .

# Executa o build do Frontend (Gera a pasta 'dist')
RUN npm run build

# Cria a pasta onde o banco de dados ficará salvo
RUN mkdir -p data

# Expõe a porta 3000
EXPOSE 3000

# Comando para iniciar o servidor
CMD ["npm", "start"]
