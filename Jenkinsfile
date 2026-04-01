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

        stage('Setup Docker & Minikube') {
            steps {
                echo "Initialisation Docker pour Minikube"
                sh 'eval $(minikube -p $MINIKUBE_PROFILE docker-env)'
            }
        }

        stage('Build Docker Images') {
            steps {
                echo "Build des images Docker"
                sh 'docker build -t identity-service:latest ./identity-service'
                sh 'docker build -t observability-frontend:latest ./frontend'
            }
        }

        stage('Apply Kubernetes Config & Restart') {
            steps {
                echo "Appliquer configs et restart des déploiements"
                sh 'kubectl apply -f identity.yaml -n $KUBE_NAMESPACE'
                sh 'kubectl rollout restart deployment identity-service -n $KUBE_NAMESPACE'
                sh 'kubectl apply -f frontend.yaml -n $KUBE_NAMESPACE'
                sh 'kubectl rollout restart deployment frontend -n $KUBE_NAMESPACE'
            }
        }

        stage('Front-end Deploy Copy') {
            steps {
                echo "Déploiement du front-end"
                sh '''
                POD=$(kubectl get pods -n $KUBE_NAMESPACE -l app=frontend -o jsonpath="{.items[0].metadata.name}")
                kubectl exec $POD -n $KUBE_NAMESPACE -- rm -rf /usr/share/nginx/html/*
                kubectl cp ./frontend/dist/. $POD:/usr/share/nginx/html -n $KUBE_NAMESPACE
                kubectl exec $POD -n $KUBE_NAMESPACE -- nginx -s reload
                '''
            }
        }

        stage('Database Check') {
            steps {
                echo "Vérification de la base PostgreSQL"
                sh 'kubectl exec postgres-55b74bf87d-vnxg8 -- psql -U postgres -d observability -c "SELECT COUNT(*) FROM users;"'
            }
        }

        stage('Clean up Docker') {
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
