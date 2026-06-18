package com.acme.admin;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

@RestController
public class AdminController {

    private final RestTemplate http = new RestTemplate();
    private static final String AUTH = "http://auth-service:8080";

    // admin ships its own copy of the login handler — duplicate of auth-service
    @PostMapping("/login")
    public String login(@RequestBody Object body) {
        // validate against auth-service -> admin calls auth (cycle: auth->profile->admin->auth)
        return http.postForObject(AUTH + "/auth/login", body, String.class);
    }

    @GetMapping("/admin")
    public Object dashboard() {
        return auditRepository.recent();
    }

    @GetMapping("/roles")
    public Object roles() {
        return roleRepository.findAll();
    }

    @GetMapping("/permissions")
    public Object permissions() {
        return roleRepository.permissions();
    }
}
