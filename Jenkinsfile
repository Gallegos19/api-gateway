pipeline {
    agent any

    tools {
        nodejs 'NodeJS'
    }

    environment {
        EC2_USER = 'ubuntu'
        SSH_KEY = credentials('ssh-key-ec2')

        DEV_IP = '3.82.128.147'
        QA_IP  = '54.173.164.179'
        PROD_IP = '44.202.126.231'
        REMOTE_PATH = '/home/ubuntu/api-gateway'
    }

    stages {
        stage('Detect Branch') {
            steps {
                script {
                    env.ACTUAL_BRANCH = env.BRANCH_NAME ?: 'master'
                    echo "🔍 Rama activa: ${env.ACTUAL_BRANCH}"
                }
            }
        }

        stage('Deploy') {
            steps {
                withCredentials([file(credentialsId: 'apigateway-env', variable: 'ENV_FILE')]) {
                    script {
                        def ip = env.ACTUAL_BRANCH == 'dev' ? DEV_IP :
                                 env.ACTUAL_BRANCH == 'qa'  ? QA_IP :
                                 env.ACTUAL_BRANCH == 'master' ? PROD_IP : null

                        def pm2_name = "${env.ACTUAL_BRANCH}-health"

                        if (ip == null) {
                            error "Branch ${env.ACTUAL_BRANCH} no está configurada para despliegue."
                        }

                        // Primero checamos si pm2 está corriendo el proceso para detenerlo
                        sh """
                        ssh -i $SSH_KEY -o StrictHostKeyChecking=no $EC2_USER@$ip '
                            if pm2 list | grep -q ${pm2_name}; then
                                echo "🛑 Deteniendo proceso pm2 ${pm2_name}..."
                                pm2 stop ${pm2_name}
                            else
                                echo "ℹ️ Proceso pm2 ${pm2_name} no estaba corriendo."
                            fi
                        '
                        """

                        // Luego subimos y reemplazamos .env
                        sh """
                        scp -i $SSH_KEY -o StrictHostKeyChecking=no $ENV_FILE $EC2_USER@$ip:/home/ubuntu/.env.temp
                        ssh -i $SSH_KEY -o StrictHostKeyChecking=no $EC2_USER@$ip '
                            echo "📋 Actualizando .env..."
                            cp /home/ubuntu/.env.temp $REMOTE_PATH/.env && rm /home/ubuntu/.env.temp
                        '
                        """

                        // Finalmente hacemos pull, npm install y reiniciamos/iniciamos pm2
                        sh """
                        ssh -i $SSH_KEY -o StrictHostKeyChecking=no $EC2_USER@$ip '
                            echo "🔁 Actualizando repositorio y dependencias..."
                            cd $REMOTE_PATH &&
                            git pull origin ${env.ACTUAL_BRANCH} &&
                            npm ci

                            echo "🚀 Reiniciando proceso pm2 ${pm2_name}..."
                            pm2 restart ${pm2_name} || pm2 start server.js --name ${pm2_name}
                        '
                        """
                    }
                }
            }
        }
    }
}
