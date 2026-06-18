package main

import (
	"os"

	"github.com/gin-gonic/gin"
)

// payment-service shares billing_db with billing-service (shared database)
const dbURL = "postgres://pg-billing:5432/billing_db"

// RISK: in-memory session state — cannot scale horizontally or restart safely
var paymentSessions = map[string]string{}

func main() {
	r := gin.Default()

	// semantic duplicate of billing-service POST /charge
	r.POST("/payments", func(c *gin.Context) {
		paymentSessions["last"] = "in-flight"
		// emit to notification-service over the queue
		publishToQueue("notification-service", "payment.captured")
		c.JSON(200, gin.H{"status": "captured"})
	})

	r.POST("/refunds", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "refunded"})
	})

	r.GET("/payments/:id", func(c *gin.Context) {
		c.JSON(200, gin.H{"id": c.Param("id")})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "9000"
	}
	r.Run(":" + port)
}

func publishToQueue(topic, event string) {
	// kafka topic publish to notification-service
}
