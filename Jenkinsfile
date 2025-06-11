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

                        sh """
                        # Copiar .env.temp directo a la carpeta de la app para evitar problemas de permisos
                        scp -i $SSH_KEY -o StrictHostKeyChecking=no $ENV_FILE $EC2_USER@$ip:$REMOTE_PATH/.env.temp

                        ssh -i $SSH_KEY -o StrictHostKeyChecking=no $EC2_USER@$ip '
                            echo "🔧 Ajustando permisos en carpeta de la app..."
                            sudo chown -R ubuntu:ubuntu $REMOTE_PATH
                            sudo chmod -R u+rwX $REMOTE_PATH

                            echo "📦 Actualizando sistema..."
                            sudo apt-get update -y &&
                            sudo apt-get upgrade -y

                            echo "📥 Verificando Node.js..."
                            if ! command -v node > /dev/null; then
                                curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - &&
                                sudo apt-get install -y nodejs
                            fi

                            echo "📥 Verificando PM2..."
                            if ! command -v pm2 > /dev/null; then
                                sudo npm install -g pm2
                            fi

                            echo "📁 Verificando carpeta de app..."
                            if [ ! -d "$REMOTE_PATH/.git" ]; then
                                git clone https://github.com/Gallegos19/api-gateway.git $REMOTE_PATH
                            fi

                            echo "📋 Actualizando .env..."
                            cp $REMOTE_PATH/.env.temp $REMOTE_PATH/.env && rm $REMOTE_PATH/.env.temp

                            echo "🔁 Pull y deploy..."
                            cd $REMOTE_PATH &&
                            git pull origin ${env.ACTUAL_BRANCH} &&
                            npm ci

                            echo "🛑 Verificando si pm2 tiene proceso activo..."
                            if pm2 list | grep -q ${pm2_name}; then
                                echo "🛑 Deteniendo proceso pm2 ${pm2_name}..."
                                pm2 stop ${pm2_name}
                            else
                                echo "ℹ️ Proceso pm2 ${pm2_name} no estaba corriendo."
                            fi

                            echo "▶️ Iniciando pm2 ${pm2_name}..."
                            pm2 start server.js --name ${pm2_name}

                            echo "✅ Deploy completado."
                        '
                        """
                    }
                }
            }
        }
    }
}
