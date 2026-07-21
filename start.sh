docker stop toolnetapi
docker rm toolnetapi
docker build -t toolnetapi .
docker run -d --name toolnetapi -p 20130:20130 --env-file .env -v toolnetapi-data:/app/data toolnetapi