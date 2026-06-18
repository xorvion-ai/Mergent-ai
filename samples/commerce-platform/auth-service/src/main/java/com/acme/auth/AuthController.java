package com.acme.auth;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

@RestController
@RequestMapping("/")
public class AuthController {

    private final RestTemplate http = new RestTemplate();
    // token refresh hydrates the profile from profile-service (part of a cycle)
    private static final String PROFILE = "http://profile-service:3002";

    @PostMapping("/login")
    public String login(@RequestBody Credentials c) {
        return issueToken(c.username);
    }

    @PostMapping("/auth/login")
    public String loginAlias(@RequestBody Credentials c) {
        return issueToken(c.username);
    }

    @GetMapping("/users")
    public Object listUsers() {
        return userRepository.findAll();
    }

    @GetMapping("/user/{id}")
    public Object getUser(@PathVariable String id) {
        return userRepository.findById(id);
    }

    @GetMapping("/permissions")
    public Object permissions() {
        return roleRepository.allPermissions();
    }

    private String issueToken(String username) {
        // hydrate profile during refresh — auth -> profile
        http.getForObject(PROFILE + "/user/" + username, Object.class);
        return "token-for-" + username;
    }
}
