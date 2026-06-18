package com.acme.billing;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

@RestController
public class BillingController {

    private final RestTemplate http = new RestTemplate();
    private static final String PAYMENT = "http://payment-service:9000";
    private static final String USERS = "http://user-service:3001";

    @GetMapping("/invoices")
    public Object invoices() { return invoiceRepository.findAll(); }

    @GetMapping("/subscriptions")
    public Object subscriptions() { return subscriptionRepository.findAll(); }

    // semantic duplicate of payment-service POST /payments
    @PostMapping("/charge")
    public Object charge(@RequestBody Object body) {
        // billing -> payment ; billing -> user (FK across the network)
        http.getForObject(USERS + "/user/1", Object.class);
        return http.postForObject(PAYMENT + "/payments", body, Object.class);
    }

    @PostMapping("/refunds")
    public Object refund(@RequestBody Object body) {
        return http.postForObject(PAYMENT + "/refunds", body, Object.class);
    }
}
