pipeline {
    agent any  // Jenkins sur la VM directement

    environment {
        GIT_BRANCH    = 'main'
        K8S_NAMESPACE = 'default'
    }

    triggers {
        pollSCM('H/2 * * * *')
    }

    stages {

        // ── 1. CHECKOUT ──────────────────────────────────────────────
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()
                    echo "📦 Commit : ${env.GIT_COMMIT_SHORT}"
                }
            }
        }

        // ── 2. DETECTION DES CHANGEMENTS ─────────────────────────────
        stage('Détecter changements') {
            steps {
                script {
                    def changedFiles = sh(
                        script: "git diff --name-only HEAD~1 HEAD 2>/dev/null || echo 'all'",
                        returnStdout: true
                    ).trim()

                    echo "📝 Fichiers modifiés :\n${changedFiles}"

                    env.BUILD_AI_ANALYZER    = (changedFiles.contains('ai-analyzer/')           || changedFiles == 'all') ? 'true' : 'false'
                    env.BUILD_ALERT_RECEIVER = (changedFiles.contains('alert-receiver/')         || changedFiles == 'all') ? 'true' : 'false'
                    env.BUILD_IDENTITY       = (changedFiles.contains('identity-service/')       || changedFiles == 'all') ? 'true' : 'false'
                    env.BUILD_METRICS_BRIDGE = (changedFiles.contains('metrics-bridge/')         || changedFiles == 'all') ? 'true' : 'false'
                    env.BUILD_FRONTEND       = (changedFiles.contains('observability-frontend/') || changedFiles == 'all') ? 'true' : 'false'
                    env.BUILD_VEEAM2         = (changedFiles.contains('veeam2/')                 || changedFiles == 'all') ? 'true' : 'false'
                    env.BUILD_VEEAM_MONITOR  = (changedFiles.contains('veeam-monitor/')          || changedFiles == 'all') ? 'true' : 'false'
                }
            }
        }

       // ── 3. BUILD DOCKER ──────────────────────────────────────────
stage('Build Docker Images') {
    steps {
        script {
            def services = [
                [flag: 'BUILD_AI_ANALYZER',    dir: 'ai-analyzer',           image: 'ai-analyzer'],
                [flag: 'BUILD_ALERT_RECEIVER', dir: 'alert-receiver',         image: 'alert-receiver'],
                [flag: 'BUILD_IDENTITY',       dir: 'identity-service',       image: 'identity-service'],
                [flag: 'BUILD_METRICS_BRIDGE', dir: 'metrics-bridge',         image: 'metrics-bridge'],
                [flag: 'BUILD_FRONTEND',       dir: 'observability-frontend', image: 'observability-frontend'],
                [flag: 'BUILD_VEEAM2',         dir: 'veeam2',                 image: 'veeam2-microservice'],
                [flag: 'BUILD_VEEAM_MONITOR',  dir: 'veeam-monitor',          image: 'veeam-monitor'],
            ]

            services.each { svc ->
                if (env[svc.flag] == 'true') {
                    echo "🐳 Building → ${svc.image}:latest"
                    sh """
                        docker build \
                          -t ${svc.image}:latest \
                          -t ${svc.image}:${env.GIT_COMMIT_SHORT} \
                          ./${svc.dir}

                        minikube image load ${svc.image}:latest
                        echo "✅ ${svc.image}:latest chargé dans Minikube"
                    """
                } else {
                    echo "⏭️  Skip ${svc.image} — pas de changement"
                }
            }
        }
    }
}

        // ── 4. DEPLOY SUR MINIKUBE ───────────────────────────────────
        stage('Deploy Kubernetes') {
            steps {
                script {
                    def deployments = [
                        [flag: 'BUILD_AI_ANALYZER',    name: 'ai-analyzer',      yaml: null],
                        [flag: 'BUILD_ALERT_RECEIVER', name: 'alert-receiver',   yaml: 'k8/alert-receiver.yaml'],
                        [flag: 'BUILD_IDENTITY',       name: 'identity-service', yaml: 'k8/identity.yaml'],
                        [flag: 'BUILD_METRICS_BRIDGE', name: 'metrics-bridge',   yaml: 'k8/metrics-bridge-deployment.yml'],
                        [flag: 'BUILD_FRONTEND',       name: 'frontend',         yaml: 'k8/frontend.yaml'],
                        [flag: 'BUILD_VEEAM2',         name: 'veeam2',           yaml: 'k8/deployment-veeam2.yaml'],
                        [flag: 'BUILD_VEEAM_MONITOR',  name: 'veeam-collector',  yaml: 'k8/deployment_veeam.yaml'],
                    ]

                    deployments.each { dep ->
                        if (env[dep.flag] == 'true') {
                            echo "🚀 Deploy → ${dep.name}"
                            if (dep.yaml) {
                                sh """
                                    kubectl apply -f ${dep.yaml} -n ${K8S_NAMESPACE}
                                    kubectl rollout restart deployment/${dep.name} -n ${K8S_NAMESPACE}
                                    kubectl rollout status deployment/${dep.name} -n ${K8S_NAMESPACE} --timeout=180s
                                """
                            } else {
                                sh """
                                    kubectl rollout restart deployment/${dep.name} -n ${K8S_NAMESPACE}
                                    kubectl rollout status deployment/${dep.name} -n ${K8S_NAMESPACE} --timeout=180s
                                """
                            }
                            echo "✅ ${dep.name} déployé !"
                        }
                    }
                }
            }
        }

        // ── 5. VERIFICATION FINALE ───────────────────────────────────
        stage('Vérification') {
            steps {
                sh """
                    echo "\\n=== PODS ==="
                    kubectl get pods -n ${K8S_NAMESPACE} -o wide

                    echo "\\n=== DEPLOYMENTS ==="
                    kubectl get deployments -n ${K8S_NAMESPACE}
                """
            }
        }
    }

    post {
        success {
            echo "✅ Pipeline réussi — commit ${env.GIT_COMMIT_SHORT} déployé !"
        }
        failure {
            echo "❌ Pipeline échoué — vérifier les logs"
        }
        always {
            echo "🔚 Fin du pipeline — ${new Date()}"
        }
    }
}
