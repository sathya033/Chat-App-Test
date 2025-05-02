import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = 'http://localhost:5000/chat'; // REST API URL
  private socketUrl = 'http://localhost:5000';  // WebSocket Server URL
  private socket: Socket;
  private currentUser: string = '';
  private notificationPermission: boolean = false;

  // BehaviorSubjects for real-time updates
  private messageSubject = new BehaviorSubject<any[]>([]);
  private typingSubject = new BehaviorSubject<{user: string, isTyping: boolean}>({user: '', isTyping: false});
  private onlineUsersSubject = new BehaviorSubject<string[]>([]);

  constructor(private http: HttpClient) {
    this.socket = io(this.socketUrl, {
      withCredentials: true,
      transports: ['websocket'],
      autoConnect: false
    });
    this.setupSocketListeners();
    this.requestNotificationPermission();
  }

  private async requestNotificationPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      this.notificationPermission = permission === 'granted';
    }
  }

  private showNotification(title: string, body: string) {
    if (this.notificationPermission && document.hidden) {
      new Notification(title, {
        body: body,
        icon: '/assets/chat-icon.png', // You can add an icon image if you have one
      });
    }
  }

  // Initialize socket connection with user info
  initializeSocket(username: string) {
    this.currentUser = username;
    if (!this.socket.connected) {
      this.socket.connect();
    }
    this.socket.emit('user_connected', { username });
  }

  private setupSocketListeners() {
    // Reconnection handling
    this.socket.on('connect', () => {
      console.log('Socket connected');
      if (this.currentUser) {
        this.socket.emit('user_connected', { username: this.currentUser });
      }
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // Private message listener
    this.socket.on('receive_private_message', (message: any) => {
      const currentMessages = this.messageSubject.value;
      if (!currentMessages.some(msg =>
        msg.sender === message.sender &&
        msg.receiver === message.receiver &&
        msg.message === message.message &&
        new Date(msg.timestamp).getTime() === new Date(message.timestamp).getTime()
      )) {
        // Show notification for new private messages
        if (message.sender !== this.currentUser) {
          this.showNotification(
            `New message from ${message.sender}`,
            message.message
          );
        }
        this.messageSubject.next([...currentMessages, message]);
      }
    });

    // Group message listener
    this.socket.on('receive_group_message', (message: any) => {
      const currentMessages = this.messageSubject.value;

      // Check if message already exists
      if (!currentMessages.some(msg =>
        msg.sender === message.sender &&
        msg.group === message.group &&
        msg.message === message.message &&
        new Date(msg.timestamp).getTime() === new Date(message.timestamp).getTime()
      )) {
        // Add new message to existing messages
        const updatedMessages = [...currentMessages, message];

        // Sort messages by timestamp
        updatedMessages.sort((a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        this.messageSubject.next(updatedMessages);

        // Show notification for new messages not from current user
        if (message.sender !== this.currentUser) {
          this.showNotification(
            `New message in ${message.group}`,
            `${message.sender}: ${message.message}`
          );
        }
      }
    });

    // Typing indicators
    this.socket.on('user_typing', (data: any) => {
      this.typingSubject.next({ user: data.sender, isTyping: true });
    });

    this.socket.on('userStoppedTyping', (data: any) => {
      this.typingSubject.next({ user: data.sender, isTyping: false });
    });

    // Online users
    this.socket.on('users_online', (users: string[]) => {
      this.onlineUsersSubject.next(users);
    });
  }

  /**  Fetch all users */
  getUsers(): Observable<any[]> {
    return this.http.get<any[]>('http://localhost:5000/api/users');
  }

  /**  Fetch chat history between two users */
  getChatHistory(user1: string, user2: string): Observable<any[]> {
    return new Observable(observer => {
      this.http.get<any[]>(`${this.apiUrl}/messages/${user1}/${user2}`).subscribe(
        (messages) => {
          this.messageSubject.next(messages);
          observer.next(messages);
          observer.complete();
        },
        (error) => {
          observer.error(error);
        }
      );
    });
  }

  // Get all groups for a user
  getGroups(username: string): Observable<any[]> {
    console.log('Fetching groups for user:', username);
    return this.http.get<any[]>(`${this.socketUrl}/chat/groups?username=${encodeURIComponent(username)}`).pipe(
      tap(groups => console.log('Fetched groups:', groups))
    );
  }

  // Get group chat history
  getGroupChatHistory(groupName: string): Observable<any[]> {
    console.log('Fetching group chat history for:', groupName);
    return this.http.get<any[]>(`${this.socketUrl}/chat/groups/messages/${encodeURIComponent(groupName)}`).pipe(
      tap(messages => {
        // Update message subject with fetched messages
        this.messageSubject.next(messages);
        // console.log('Group chat history:', messages);
      })
    );
  }

  // Send private message
  sendPrivateMessage(receiver: string, message: string): void {
    const messageData = {
      sender: this.currentUser,
      receiver,
      message,
      timestamp: new Date()
    };

    // The message will be added when received from the socket
    this.socket.emit('send_private_message', messageData);
  }

  // Send group message
  sendGroupMessage(groupName: string, message: string): void {
    console.log('Sending group message:', { group: groupName, message });
    const messageData = {
      sender: this.currentUser,
      group: groupName,
      message,
      timestamp: new Date(),
      readBy: [this.currentUser] // Mark as read by sender
    };

    // Emit to socket - don't manually add message, let socket handle it
    this.socket.emit('send_group_message', messageData);
  }

  putGroupMessage(data:any): Observable<any> {
    console.log("--------------------------------------------",data);
    return this.http.put<any>(`${this.socketUrl}/groups/userMessage`,data);
  }

  // Join group (socket)
  joinGroup(groupName: string) {
    console.log('Joining group:', groupName);
    this.socket.emit('join_group', { group: groupName, user: this.currentUser });
  }

  // Leave a group
  leaveGroup(groupName: string): void {
    this.socket.emit('leave_group', { group: groupName, user: this.currentUser });
  }

  // Get message updates
  getMessages(): Observable<any[]> {
    return this.messageSubject.asObservable();
  }

  // Get typing status updates
  getTypingStatus(): Observable<{user: string, isTyping: boolean}> {
    return this.typingSubject.asObservable();
  }

  // Get online users updates
  getOnlineUsers(): Observable<string[]> {
    return this.onlineUsersSubject.asObservable();
  }

  // Add method to get unread message count
  getUnreadMessageCount(username: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/messages/unread/${username}`);
  }

  getGroupUnreadCount(groupName: string, username: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/groups/unread/${groupName}/${username}`);
  }

  markGroupMessagesAsRead(groupName: string, username: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/groups/messages/read/${groupName}/${username}`, {});
  }

  // Add method to mark messages as read
  markMessagesAsRead(currentUser: string, sender: string): Observable<any> {
    return this.http.put<any>(`${this.socketUrl}/chat/messages/read/${sender}/${currentUser}`, {});
  }

  // Emit typing status for private chat
  emitTyping(receiver: string, isTyping: boolean): void {
    const data = { sender: this.currentUser, receiver };
    this.socket.emit(isTyping ? 'typing' : 'stop_typing', data);
  }

  // Emit typing status for group chat
  emitGroupTyping(groupName: string, isTyping: boolean): void {
    const data = { sender: this.currentUser, group: groupName };
    this.socket.emit(isTyping ? 'typing_group' : 'stop_typing_group', data);
  }

  // Create a new group
  createGroup(data: { groupName: string; admin: string }): Observable<any> {
    console.log('Creating group:', data);
    return this.http.post(`${this.socketUrl}/chat/groups/create`, data).pipe(
      tap(response => console.log('Group creation response:', response))
    );
  }

  // Add user to group
  addUserToGroup(data: { groupName: string; username: string }): Observable<any> {
    console.log('Adding user to group:', data);
    return this.http.post(`${this.socketUrl}/chat/groups/add-user`, data).pipe(
      tap(response => console.log('Add user to group response:', response))
    );
  }

  // Cleanup on component destroy
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  // Update messages
  updateMessages(messages: any[]) {
    this.messageSubject.next(messages);
  }


}

