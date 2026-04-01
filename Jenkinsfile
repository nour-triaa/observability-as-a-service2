pipeline {
    agent any

    environment {
        MINIKUBE_PROFILE = 'minikube'
        KUBE_NAMESPACE = 'observability'
    }

    stages {
        stage('Checkout') {
            steps {
                echo "Récupération du code depuis Git"
                checkout scm
            }
        }

        stage('Detect Changes') {
            steps {
                script {
                    // Liste des microservices
                    def services = ['identity-service', 'frontend']

                    // Détecte quels dossiers ont changé depuis le dernier commit
                    def changedServices = []

                    for (s in services) {
                        def diff = sh(
                            script: "git diff --name-only HEAD~1 HEAD | grep '^${s}/' || true",
                            returnStdout: true
                        ).trim()
                        if (diff) {
                            echo "${s} a été modifié"
                            changedServices.add(s)
                        } else {
                            echo "${s} n'a pas été modifié"
                        }
                    }

                    // Stocke les services modifiés pour les étapes suivantes
                    env.CHANGED_SERVICES = changedServices.join(' ')
                }
            }
        }

        stage('Setup Docker & Minikube') {
            when {
                expression { env.CHANGED_SERVICES }
            }
            steps {
                echo "Initialisation Docker pour Minikube"
                sh 'eval $(minikube -p $MINIKUBE_PROFILE docker-env)'
            }
        }

        stage('Build Docker Images') {
            when {
                expression { env.CHANGED_SERVICES }
            }
            steps {
                script {
                    if (env.CHANGED_SERVICES.contains('identity-service')) {
                        sh 'docker build -t identity-service:latest ./identity-service'
                    }
                    if (env.CHANGED_SERVICES.contains('frontend')) {
                        sh 'docker build -t observability-frontend:latest ./frontend'
                    }
                }
            }
        }

        stage('Apply Kubernetes Config & Restart') {
            when {
                expression { env.CHANGED_SERVICES }
            }
            steps {
                script {
                    if (env.CHANGED_SERVICES.contains('identity-service')) {
                        sh 'kubectl apply -f identity.yaml -n $KUBE_NAMESPACE'
                        sh 'kubectl rollout restart deployment identity-service -n $KUBE_NAMESPACE'
                    }
                    if (env.CHANGED_SERVICES.contains('frontend')) {
                        sh 'kubectl apply -f frontend.yaml -n $KUBE_NAMESPACE'
                        sh 'kubectl rollout restart deployment frontend -n $KUBE_NAMESPACE'
                    }
                }
            }
        }

        stage('Front-end Deploy Copy') {
            when {
                expression { env.CHANGED_SERVICES.contains('frontend') }
            }
            steps {
                echo "Déploiement du front-end uniquement si modifié"
                sh '''
                POD=$(kubectl get pods -n $KUBE_NAMESPACE -l app=frontend -o jsonpath="{.items[0].metadata.name}")
                kubectl exec -it $POD -n $KUBE_NAMESPACE -- rm -rf /usr/share/nginx/html/*
                kubectl cp ./frontend/dist/. $POD:/usr/share/nginx/html -n $KUBE_NAMESPACE
                kubectl exec -it $POD -n $KUBE_NAMESPACE -- nginx -s reload
                '''
            }
        }

        stage('Database Check') {
            steps {
                echo "Vérification de la base PostgreSQL"
                sh '''
                kubectl exec -it postgres-55b74bf87d-vnxg8 -- psql -U postgres -d observability -c "SELECT COUNT(*) FROM users;"
                '''
            }
        }

        stage('Clean up Docker') {
            when {
                expression { env.CHANGED_SERVICES }
            }
            steps {
                echo "Nettoyage des anciennes images Docker"
                sh 'docker rmi -f identity-service:latest || true'
                sh 'docker rmi -f observability-frontend:latest || true'
            }
        }
    }

    post {
        always { echo 'Pipeline terminé' }
        success { echo 'Pipeline réussi 🎉' }
        failure { echo 'Pipeline échoué ⚠️' }
    }
}
