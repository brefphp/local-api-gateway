FROM node:18-alpine as base

# Fake AWS credentials so that the Lambda client works
ENV AWS_ACCESS_KEY_ID='fake'
ENV AWS_SECRET_ACCESS_KEY='fake'

WORKDIR /app

COPY package.json ./
RUN npm install --verbose && npm cache clean --force

COPY . .
