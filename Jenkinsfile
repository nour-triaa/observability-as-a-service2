 










pipeline {
    agent {
        kubernetes {
            namespace 'cicd'
            yaml """
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins
  containers:

  - name: docker
    image: docker:24-cli
    command: ['sleep', '9999']
    env:
    - name: DOCKER_HOST
      value: "tcp://192.168.49.2:2376"
    - name: DOCKER_TLS_VERIFY
      value: "1"
    - name: DOCKER_CERT_PATH
      value: "/certs"
    volumeMounts:
    - name: minikube-certs
      mountPath: /certs
      readOnly: true

  - name: kubectl
    image: bitnami/kubectl:latest
    command: ['sleep', '9999']
    securityContext:
      runAsUser: 0

  volumes:
  - name: minikube-certs
    secret:
      secretName: minikube-docker-certs
"""
        }
    }

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
                        script: """
                            git diff --name-only HEAD~1 HEAD 2>/dev/null \
                            || git show --stat HEAD --name-only \
                            | grep -v '^commit\\|^Author\\|^Date\\|^\\s' \
                            || echo "all"
                        """,
                        returnStdout: true
                    ).trim()

                    echo "📝 Fichiers modifiés :\n${changedFiles}"

                    // Force rebuild si changement dans k8/ aussi
                    env.BUILD_AI_ANALYZER    = (changedFiles.contains('ai-analyzer/')       || changedFiles == 'all') ? 'true' : 'false'
                    env.BUILD_ALERT_RECEIVER = (changedFiles.contains('alert-receiver/')     || changedFiles == 'all') ? 'true' : 'false'
                    env.BUILD_IDENTITY       = (changedFiles.contains('identity-service/')   || changedFiles == 'all') ? 'true' : 'false'
                    env.BUILD_METRICS_BRIDGE = (changedFiles.contains('metrics-bridge/')     || changedFiles == 'all') ? 'true' : 'false'
                    env.BUILD_FRONTEND       = (changedFiles.contains('observability-frontend/') || changedFiles == 'all') ? 'true' : 'false'
                    env.BUILD_VEEAM2         = (changedFiles.contains('veeam2/')             || changedFiles == 'all') ? 'true' : 'false'
                    env.BUILD_VEEAM_MONITOR  = (changedFiles.contains('veeam-monitor/')      || changedFiles == 'all') ? 'true' : 'false'

                    echo """
┌─────────────────────────────────────┐
│       Services à rebuilder          │
├─────────────────────────────────────┤
│ ai-analyzer        : ${env.BUILD_AI_ANALYZER.padRight(5)} │
│ alert-receiver     : ${env.BUILD_ALERT_RECEIVER.padRight(5)} │
│ identity-service   : ${env.BUILD_IDENTITY.padRight(5)} │
│ metrics-bridge     : ${env.BUILD_METRICS_BRIDGE.padRight(5)} │
│ frontend           : ${env.BUILD_FRONTEND.padRight(5)} │
│ veeam2             : ${env.BUILD_VEEAM2.padRight(5)} │
│ veeam-monitor      : ${env.BUILD_VEEAM_MONITOR.padRight(5)} │
└─────────────────────────────────────┘"""
                }
            }
        }

        // ── 3. BUILD IMAGES DOCKER ───────────────────────────────────
        stage('Build Docker Images') {
            steps {
                container('docker') {
                    script {
                        // Vérifier la connexion au daemon Minikube
                        sh 'docker info > /dev/null && echo "✅ Connecté au Docker Minikube"'

                        def services = [
                            [flag: 'BUILD_AI_ANALYZER',    dir: 'ai-analyzer',          image: 'ai-analyzer'],
                            [flag: 'BUILD_ALERT_RECEIVER', dir: 'alert-receiver',        image: 'alert-receiver'],
                            [flag: 'BUILD_IDENTITY',       dir: 'identity-service',      image: 'identity-service'],
                            [flag: 'BUILD_METRICS_BRIDGE', dir: 'metrics-bridge',        image: 'metrics-bridge'],
                            [flag: 'BUILD_FRONTEND',       dir: 'observability-frontend',image: 'observability-frontend'],
                            [flag: 'BUILD_VEEAM2',         dir: 'veeam2',                image: 'veeam2-microservice'],
                            [flag: 'BUILD_VEEAM_MONITOR',  dir: 'veeam-monitor',         image: 'veeam-monitor'],
                        ]

                        services.each { svc ->
                            if (env[svc.flag] == 'true') {
                                echo "🐳 Building → ${svc.image}:latest"
                                sh """
                                    docker build \
                                      -t ${svc.image}:latest \
                                      -t ${svc.image}:${env.GIT_COMMIT_SHORT} \
                                      ./${svc.dir}

                                    echo "✅ ${svc.image}:latest construit"
                                """
                            } else {
                                echo "⏭️  Skip : ${svc.image} (pas de changement)"
                            }
                        }

                        // Afficher toutes les images custom présentes
                        echo "=== Images dans Minikube ==="
                        sh """
                            docker images | grep -E \
                              'ai-analyzer|alert-receiver|identity-service|metrics-bridge|observability-frontend|veeam2|veeam-monitor|veeam-collector|vmware-ml'
                        """
                    }
                }
            }
        }

        // ── 4. DEPLOY SUR KUBERNETES ─────────────────────────────────
        stage('Deploy Kubernetes') {
            steps {
                container('kubectl') {
                    script {
                        def deployments = [
                            [
                                flag  : 'BUILD_AI_ANALYZER',
                                name  : 'ai-analyzer',
                                yaml  : null   // pas de yaml séparé, rollout suffit
                            ],
                            [
                                flag  : 'BUILD_ALERT_RECEIVER',
                                name  : 'alert-receiver',
                                yaml  : 'k8/alert-receiver.yaml'
                            ],
                            [
                                flag  : 'BUILD_IDENTITY',
                                name  : 'identity-service',
                                yaml  : 'k8/identity.yaml'
                            ],
                            [
                                flag  : 'BUILD_METRICS_BRIDGE',
                                name  : 'metrics-bridge',
                                yaml  : 'k8/metrics-bridge-deployment.yml'
                            ],
                            [
                                flag  : 'BUILD_FRONTEND',
                                name  : 'frontend',
                                yaml  : 'k8/frontend.yaml'
                            ],
                            [
                                flag  : 'BUILD_VEEAM2',
                                name  : 'veeam2',
                                yaml  : 'k8/deployment-veeam2.yaml'
                            ],
                            [
                                flag  : 'BUILD_VEEAM_MONITOR',
                                name  : 'veeam-collector',
                                yaml  : 'k8/deployment_veeam.yaml'
                            ],
                        ]

                        deployments.each { dep ->
                            if (env[dep.flag] == 'true') {
                                echo "🚀 Deploy → ${dep.name}"

                                if (dep.yaml) {
                                    // Apply le yaml + rollout restart
                                    sh """
                                        kubectl apply -f ${dep.yaml} -n ${K8S_NAMESPACE}
                                        kubectl rollout restart deployment/${dep.name} -n ${K8S_NAMESPACE}
                                        kubectl rollout status deployment/${dep.name} -n ${K8S_NAMESPACE} --timeout=180s
                                    """
                                } else {
                                    // Rollout restart uniquement
                                    sh """
                                        kubectl rollout restart deployment/${dep.name} -n ${K8S_NAMESPACE}
                                        kubectl rollout status deployment/${dep.name} -n ${K8S_NAMESPACE} --timeout=180s
                                    """
                                }
                                echo "✅ ${dep.name} déployé avec succès"
                            }
                        }
                    }
                }
            }
        }

        // ── 5. VERIFICATION FINALE ───────────────────────────────────
        stage('Vérification') {
            steps {
                container('kubectl') {
                    sh """
                        echo "\\n=== PODS namespace: ${K8S_NAMESPACE} ==="
                        kubectl get pods -n ${K8S_NAMESPACE} -o wide

                        echo "\\n=== DEPLOYMENTS ==="
                        kubectl get deployments -n ${K8S_NAMESPACE}

                        echo "\\n=== EVENTS récents ==="
                        kubectl get events -n ${K8S_NAMESPACE} \
                          --sort-by='.lastTimestamp' | tail -10
                    """
                }
            }
        }
    }

    // ── POST ─────────────────────────────────────────────────────────
    post {
        success {
            echo "✅ Pipeline réussi — commit ${env.GIT_COMMIT_SHORT} déployé !"
        }
        failure {
            echo "❌ Pipeline échoué — vérifier les logs"
            container('kubectl') {
                sh """
                    echo "=== PODs en erreur ==="
                    kubectl get pods -n ${K8S_NAMESPACE} | grep -v Running || true
                """
            }
        }
        always {
            echo "🔚 Fin du pipeline — ${new Date()}"
        }
    }
}




































































































