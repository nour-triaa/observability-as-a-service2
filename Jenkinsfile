pipeline {
    agent any

    environment {
        MINIKUBE_PROFILE = 'minikube'
        KUBE_NAMESPACE = 'observability'
    }

    stages {
        stage('Setup Docker & Minikube') {
            steps {
                echo "Initialisation Docker pour Minikube"
                sh 'eval $(minikube -p $MINIKUBE_PROFILE docker-env)'
            }
        }

        stage('Check Changed Services') {
            steps {
                echo "Détecter les microservices modifiés"
                script {
                    // Lister les dossiers des microservices
                    def services = ['identity-service', 'frontend', 'other-service']
                    env.CHANGED_SERVICES = ""
                    
                    // Comparer avec la dernière version commitée pour voir ce qui a changé
                    for (s in services) {
                        def diff = sh(script: "git diff --name-only HEAD~1 HEAD ${s}/ | wc -l", returnStdout: true).trim()
                        if (diff != "0") {
                            env.CHANGED_SERVICES += "${s} "
                        }
                    }
                    echo "Services modifiés : ${env.CHANGED_SERVICES}"
                }
            }
        }

        stage('Build Docker Images') {
            when {
                expression { env.CHANGED_SERVICES != "" }
            }
            steps {
                echo "Build des images Docker pour les services modifiés"
                script {
                    if (env.CHANGED_SERVICES.contains('identity-service')) {
                        sh 'docker build -t identity-service:latest ./identity-service'
                    }
                    if (env.CHANGED_SERVICES.contains('frontend')) {
                        sh 'docker build -t observability-frontend:latest ./frontend'
                    }
                    if (env.CHANGED_SERVICES.contains('other-service')) {
                        sh 'docker build -t other-service:latest ./other-service'
                    }
                }
            }
        }

        stage('Apply Kubernetes Config') {
            steps {
                echo "Appliquer les configurations Kubernetes"
                sh 'kubectl apply -f identity.yaml || true'
                sh 'kubectl apply -f frontend.yaml || true'
                sh 'kubectl apply -f other-service.yaml || true'
            }
        }

        stage('Restart Deployments') {
            steps {
                echo "Redémarrage des deployments des services modifiés"
                script {
                    if (env.CHANGED_SERVICES.contains('identity-service')) {
                        sh 'kubectl rollout restart deployment identity-service -n $KUBE_NAMESPACE'
                    }
                    if (env.CHANGED_SERVICES.contains('frontend')) {
                        sh 'kubectl rollout restart deployment frontend -n $KUBE_NAMESPACE'
                    }
                    if (env.CHANGED_SERVICES.contains('other-service')) {
                        sh 'kubectl rollout restart deployment other-service -n $KUBE_NAMESPACE'
                    }
                }
            }
        }

        stage('Front-end Deploy Copy') {
            when {
                expression { env.CHANGED_SERVICES.contains('frontend') }
            }
            steps {
                echo "Déploiement du front-end"
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
            steps {
                echo "Nettoyage des anciennes images Docker"
                sh 'docker rmi -f identity-service:latest || true'
                sh 'docker rmi -f observability-frontend:latest || true'
                sh 'docker rmi -f other-service:latest || true'
            }
        }
    }

    post {
        always {
            echo 'Pipeline terminé'
        }
        success {
            echo 'Pipeline réussi 🎉'
        }
        failure {
            echo 'Pipeline échoué ⚠️'
        }
    }
}
